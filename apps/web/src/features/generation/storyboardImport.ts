import * as XLSX from "xlsx";
import mammoth from "mammoth";

const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv", "tsv"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown"]);

export type StoryboardImportResult = {
  fileName: string;
  columns: string[];
  rows: string[][];
  text: string;
  sourceType: "spreadsheet" | "word" | "text";
};

export async function parseStoryboardFile(file: File): Promise<StoryboardImportResult> {
  const extension = getFileExtension(file.name);
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return {
      fileName: file.name,
      sourceType: "spreadsheet",
      ...await parseSpreadsheet(file, extension),
    };
  }
  if (extension === "docx") {
    const text = await parseDocx(file);
    return {
      fileName: file.name,
      sourceType: "word",
      columns: ["内容"],
      rows: text.split(/\n{2,}/).map((section) => [section]).filter((row) => row[0].trim()),
      text,
    };
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    const text = normalizeImportedText(await file.text());
    return {
      fileName: file.name,
      sourceType: "text",
      columns: ["内容"],
      rows: text.split(/\n{2,}/).map((section) => [section]).filter((row) => row[0].trim()),
      text,
    };
  }
  throw new Error(`不支持的分镜文件类型：.${extension || file.name}`);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

async function parseSpreadsheet(file: File, extension: string) {
  const workbook =
    extension === "csv" || extension === "tsv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstStructuredSheet = workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
      const normalizedRows = rows
        .map((row) => row.map((cell) => String(cell ?? "").trim()))
        .filter((row) => row.some(Boolean));
      if (normalizedRows.length === 0) return undefined;
      const [header, ...body] = normalizedRows;
      return {
        columns: header.map((cell, index) => cell || `列${index + 1}`),
        rows: body,
      };
    })
    .find((sheet) => sheet && sheet.columns.length > 0);
  const sections = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", blankrows: false });
    const text = normalizeImportedText(csv);
    return text ? `# ${sheetName}\n${text}` : "";
  }).filter(Boolean);
  const text = normalizeImportedText(sections.join("\n\n"));
  return {
    columns: firstStructuredSheet?.columns ?? ["内容"],
    rows: firstStructuredSheet?.rows ?? text.split("\n").map((line) => [line]),
    text,
  };
}

async function parseDocx(file: File) {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return normalizeImportedText(result.value);
}

function normalizeImportedText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line, index, lines) => line.trim() || lines[index - 1]?.trim())
    .join("\n")
    .trim();
}
