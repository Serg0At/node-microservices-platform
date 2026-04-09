import protoLoader from "@grpc/proto-loader";
import grpc from "@grpc/grpc-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const loadAdminProto = () => {
  const protoPath = path.join(__dirname, "../../proto/admin.proto");
  const pkgDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  return grpc.loadPackageDefinition(pkgDef).admin;
};
