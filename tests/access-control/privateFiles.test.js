import assert from "node:assert/strict"; import fs from "node:fs"; import test from "node:test";
const sql=fs.readFileSync(new URL("../../database/supabase-workspace-storage.sql",import.meta.url),"utf8"); const fn=fs.readFileSync(new URL("../../supabase/functions/workspace-private-files/index.ts",import.meta.url),"utf8");
test("private file metadata is protected",()=>{assert.match(sql,/false/i);assert.match(sql,/workspace_private_files/i);assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);});
test("edge function validates access and files",()=>{assert.match(fn,/Authorization/i);assert.match(fn,/getUser/i);assert.match(fn,/finance|storage/i);assert.match(fn,/MAX_FILE_SIZE/i);assert.match(fn,/ALLOWED_TYPES/i);assert.match(fn,/createSigned/i);});
