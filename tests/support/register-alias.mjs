// 用法：node --import ./tests/support/register-alias.mjs --test …（npm run test:hr 已經帶上）
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
