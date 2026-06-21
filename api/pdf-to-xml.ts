import { PDFParse } from "pdf-parse";
import { parseDanfeText } from "../src/lib/pdf-text-parser";

async function readRawBody(req: import("http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: import("http").IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> },
  res: import("http").ServerResponse
) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const buffer = await readRawBody(req);
    const contentType = String(req.headers["content-type"] || "");
    let fileName = String(req.headers["x-file-name"] || "");
    let pdfBuffer: Buffer | null = null;

    if (contentType.includes("application/pdf")) {
      pdfBuffer = buffer;
      if (!fileName) {
        fileName = "convertido.pdf";
      }
    } else {
      const bodyText = buffer.toString("utf-8");
      const body = JSON.parse(bodyText || "{}");
      const { fileBase64, fileName: jsonFileName } = body as { fileBase64?: string; fileName?: string };
      fileName = fileName || jsonFileName || fileName;
      if (!fileBase64) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Nenhum arquivo PDF enviado no corpo da requisição." }));
        return;
      }
      pdfBuffer = Buffer.from(fileBase64, "base64");
    }

    const parser = new PDFParse({ data: pdfBuffer });

    try {
      const textResult = await parser.getText();
      const text = textResult.text;
      const { xml, data } = parseDanfeText(text, fileName);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        xml,
        fileName: fileName ? fileName.replace(/\.pdf$/i, ".xml") : "convertido.xml",
        parsedData: data,
      }));
    } finally {
      await parser.destroy();
    }
  } catch (err: any) {
    console.error("Erro na API /api/pdf-to-xml:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message || "Erro desconhecido ao converter PDF para XML." }));
  }
}
