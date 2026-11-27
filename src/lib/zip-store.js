// 最小的 ZIP 產生器（不壓縮、不需要額外套件）。
// 文件都是 PDF／JPG／PNG，本身已經壓縮過，所以用「儲存」模式即可；檔名以 UTF-8 儲存，中文檔名在 Windows／macOS 都能正常顯示。

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const MAX_ENTRIES = 0xfffe;
const MAX_BYTES = 0xfffffffe; // 不使用 ZIP64：總大小需小於 4 GB

// entries: [{ name: string, data: Buffer }]；回傳完整的 ZIP Buffer。
export function createZip(entries, date = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('zip_requires_entries');
  if (entries.length > MAX_ENTRIES) throw new Error('zip_too_many_entries');
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = (Math.max(date.getFullYear(), 1980) - 1980 << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    if (!name.length || name.length > 0xffff) throw new Error('zip_invalid_name');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // 解壓縮需要的版本
    local.writeUInt16LE(0x0800, 6); // 旗標：檔名為 UTF-8
    local.writeUInt16LE(0, 8); // 方法：儲存（不壓縮）
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
    if (offset > MAX_BYTES) throw new Error('zip_too_large');
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function dosStamp(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: (Math.max(date.getFullYear(), 1980) - 1980 << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function localHeader(name, crc, size, stamp) {
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(size, 18);
  local.writeUInt32LE(size, 22);
  local.writeUInt16LE(name.length, 26);
  return local;
}

function centralHeader(name, crc, size, offset, stamp) {
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(stamp.time, 12);
  central.writeUInt16LE(stamp.day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(size, 20);
  central.writeUInt32LE(size, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  return central;
}

// 串流版：一次只把「一個檔案」讀進記憶體，送出後就釋放，不會把整包 ZIP 組在記憶體裡。
// entries: [{ name, size, load: async () => Buffer }]；size 必須事先知道（用來算出 Content-Length），
// load() 回傳的長度與 size 不符時串流會中止（避免產生壞掉的 ZIP）。
// 回傳 { stream: ReadableStream<Uint8Array>, length }。onComplete 在全部送完後呼叫（例如寫下載紀錄）。
export function createZipStream(entries, { date = new Date(), onComplete, onError } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('zip_requires_entries');
  if (entries.length > MAX_ENTRIES) throw new Error('zip_too_many_entries');
  const items = entries.map(entry => {
    const name = Buffer.from(String(entry.name), 'utf8');
    const size = Number(entry.size);
    if (!name.length || name.length > 0xffff) throw new Error('zip_invalid_name');
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('zip_invalid_size');
    if (typeof entry.load !== 'function') throw new Error('zip_invalid_entry');
    return { name, size, load: entry.load };
  });
  const localsSize = items.reduce((sum, item) => sum + 30 + item.name.length + item.size, 0);
  const centralSize = items.reduce((sum, item) => sum + 46 + item.name.length, 0);
  if (localsSize > MAX_BYTES) throw new Error('zip_too_large');
  const length = localsSize + centralSize + 22;
  const stamp = dosStamp(date);
  const centrals = [];
  let index = 0;
  let offset = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (index < items.length) {
          const item = items[index];
          let data = await item.load();
          if (cancelled) return;
          data = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (data.length !== item.size) throw new Error('zip_size_mismatch');
          const crc = crc32(data);
          controller.enqueue(new Uint8Array(Buffer.concat([localHeader(item.name, crc, item.size, stamp), item.name])));
          controller.enqueue(new Uint8Array(data.buffer, data.byteOffset, data.length));
          centrals.push(centralHeader(item.name, crc, item.size, offset, stamp), item.name);
          offset += 30 + item.name.length + item.size;
          index += 1;
          return;
        }
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(items.length, 8);
        end.writeUInt16LE(items.length, 10);
        end.writeUInt32LE(centralSize, 12);
        end.writeUInt32LE(offset, 16);
        controller.enqueue(new Uint8Array(Buffer.concat([...centrals, end])));
        controller.close();
        if (onComplete) await Promise.resolve(onComplete()).catch(() => {});
      } catch (error) {
        if (onError) onError(error);
        controller.error(error);
      }
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return { stream, length };
}
