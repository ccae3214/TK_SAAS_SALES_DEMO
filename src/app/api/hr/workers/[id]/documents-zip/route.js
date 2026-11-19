import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/auth';
import { ensureHrIdentitySchema, getHrPrincipal } from '@/lib/hr-access';
import { createZip } from '@/lib/zip-store';
import {
  MAX_ZIP_SOURCE_BYTES, documentEntryName, documentsManifest, safeFileName, workerDocumentsAccessError,
} from '@/lib/hr-worker-documents-zip';

// 已配對到雇主的工作者：把「已審核通過」的文件（每項取最新核准版本）打包成一個 ZIP，
// 讓雇主與仲介入境時一次下載。權限規則見 hr-worker-documents-zip.js。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (message, status) => NextResponse.json({ error: message }, { status });

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) return fail('Authentication required', 401);
  const { id: rawId } = await params;
  const workerId = Number(rawId);
  if (!Number.isSafeInteger(workerId) || workerId <= 0) return fail('工作者編號不正確。', 400);
  const key = Buffer.from(process.env.HR_DOCUMENT_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) return fail('文件加密金鑰尚未設定。', 503);
  try {
    await ensureHrIdentitySchema();
    const principal = await getHrPrincipal(session);
    const workerRows = (await pool.query('SELECT id,name,agency_id FROM hr_workers WHERE id=$1', [workerId])).rows;
    if (!workerRows.length) return fail('找不到工作者資料。', 404);
    const worker = workerRows[0];
    const caseRows = (await pool.query(`SELECT c.id,c.employer_id,e.agency_id AS employer_agency_id
      FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id WHERE c.worker_id=$1`, [workerId])).rows;
    const denied = workerDocumentsAccessError(principal, worker, caseRows);
    if (denied) return fail(denied.message, denied.status);

    // 每一項適用且已核准的文件，取最新一版「核准」的檔案。
    const files = (await pool.query(`SELECT r.id AS requirement_id,r.name,s.id AS submission_id,s.version_number,
        f.original_filename,f.content_type,f.size_bytes,f.sha256
      FROM hr_worker_documents r
      JOIN LATERAL (SELECT s.id,s.version_number FROM hr_document_submissions s
        JOIN hr_document_reviews v ON v.submission_id=s.id AND v.decision='approved'
        WHERE s.requirement_id=r.id ORDER BY s.version_number DESC LIMIT 1) s ON TRUE
      JOIN hr_document_files f ON f.submission_id=s.id
      WHERE r.worker_id=$1 AND r.applicable AND r.status='approved'
      ORDER BY r.id`, [workerId])).rows;
    if (!files.length) return fail('這位工作者目前沒有已審核通過的文件可以下載。', 404);
    if (files.reduce((sum, file) => sum + Number(file.size_bytes || 0), 0) > MAX_ZIP_SOURCE_BYTES) {
      return fail('已核准文件的總大小超過打包上限，請改為逐份下載。', 413);
    }

    const entries = [];
    const manifestItems = [];
    for (const [index, file] of files.entries()) {
      const blob = (await pool.query('SELECT iv,auth_tag,encrypted_data FROM hr_document_files WHERE submission_id=$1', [file.submission_id])).rows[0];
      const decipher = createDecipheriv('aes-256-gcm', key, blob.iv);
      decipher.setAuthTag(blob.auth_tag);
      const data = Buffer.concat([decipher.update(blob.encrypted_data), decipher.final()]);
      const actual = createHash('sha256').update(data).digest();
      const stored = Buffer.from(file.sha256, 'hex');
      if (actual.length !== stored.length || !timingSafeEqual(actual, stored)) throw new Error('document_integrity_check_failed');
      const entryName = documentEntryName(index, file.name, file.content_type);
      entries.push({ name: entryName, data });
      manifestItems.push({ entryName, name: file.name, version: file.version_number, originalFilename: file.original_filename, sha256: file.sha256 });
    }
    const manifest = documentsManifest(worker.name, manifestItems);
    entries.push({ name: '00_文件清單_Document-list.txt', data: Buffer.from(`﻿${manifest}`, 'utf8') });
    const zip = createZip(entries);

    const actor = session.user?.email || session.user?.lineUserId || '登入帳號';
    await pool.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) SELECT id,$2,$3,$4 FROM hr_cases WHERE worker_id=$1',
      [workerId, actor, '打包下載已核准文件', `${files.length} 份`]);

    const fileName = `${safeFileName(worker.name, 'worker')}_approved-documents.zip`;
    return new Response(zip, { headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="approved-documents.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    } });
  } catch (error) {
    console.error('hr_worker_documents_zip_failed', error?.name || 'Error', error?.message === 'document_integrity_check_failed' ? 'integrity' : '');
    return fail('無法產生文件壓縮檔，請確認文件加密金鑰正確後再試。', 500);
  }
}
