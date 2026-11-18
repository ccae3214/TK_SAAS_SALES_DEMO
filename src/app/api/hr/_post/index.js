// POST /api/hr 的動作分派：依 body.type 找到對應 handler，並用該 handler 自己的 allow 檢查角色。
// 沒有任何 handler 允許時：非管理者回 403，管理者回 400（動作名稱不正確）。
import { NextResponse } from 'next/server';
import { createJobOrder, assignTaiwanAgency, assignPhilippinesAgencies, recommendCandidate, employerPickCandidate } from './job-orders';
import { createAgencyWorker, createAgency, createMember, createEmployerOrWorker } from './people';
import { createCase, addRequirement, addTask } from './cases';

export const POST_HANDLERS = [
  createJobOrder,
  assignTaiwanAgency,
  assignPhilippinesAgencies,
  recommendCandidate,
  employerPickCandidate,
  createAgencyWorker,
  createAgency,
  createMember,
  createEmployerOrWorker,
  createCase,
  addRequirement,
  addTask,
];

export async function dispatchPost(ctx) {
  const { principal, body } = ctx;
  const handler = POST_HANDLERS.find(item => item.types.includes(body.type) && item.allow(principal));
  if (handler) return handler.run(ctx);
  if (principal.role !== 'admin') return NextResponse.json({ error: 'HR admin access required' }, { status: 403 });
  return NextResponse.json({ error: '新增項目不正確。' }, { status: 400 });
}
