import {invokeSupabaseFunction} from "./supabaseClient.js";
export const requestPrivateUpload=(workspace,file,resourceId)=>invokeSupabaseFunction("workspace-private-files",{action:"upload",workspace,fileName:file.name,contentType:file.type,size:file.size,resourceId});
export const requestPrivateDownload=(workspace,path)=>invokeSupabaseFunction("workspace-private-files",{action:"download",workspace,path});
