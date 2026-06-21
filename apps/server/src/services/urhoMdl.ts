import fs from "node:fs";
import path from "node:path";

const TYPE_SIZES = [4, 4, 8, 12, 16, 4, 4];
const TYPE_NAMES = ["TYPE_INT", "TYPE_FLOAT", "TYPE_VECTOR2", "TYPE_VECTOR3", "TYPE_VECTOR4", "TYPE_UBYTE4", "TYPE_UBYTE4_NORM"];
const SEMANTIC_NAMES = ["SEM_POSITION", "SEM_NORMAL", "SEM_BINORMAL", "SEM_TANGENT", "SEM_TEXCOORD", "SEM_COLOR", "SEM_BLENDWEIGHTS", "SEM_BLENDINDICES", "SEM_OBJECTINDEX"];
const PRIMITIVE_NAMES = ["TRIANGLE_LIST", "LINE_LIST", "POINT_LIST", "TRIANGLE_STRIP", "LINE_STRIP", "TRIANGLE_FAN"];
const LEGACY_ELEMENTS: Array<[number, number, number]> = [[3, 0, 0], [3, 1, 0], [5, 5, 0], [2, 4, 0], [2, 4, 1], [3, 4, 0], [3, 4, 1], [4, 3, 0], [4, 6, 0], [5, 7, 0], [4, 4, 4], [4, 4, 5], [4, 4, 6], [1, 8, 0]];

type VertexElement = { elementType: number; semantic: number; index: number; offset: number; size: number };
type VertexBuffer = { vertexCount: number; vertexSize: number; elements: VertexElement[]; morphRangeStart: number; morphRangeCount: number; data: Buffer };
type IndexBuffer = { indexCount: number; indexSize: number; data: Buffer };
type LodLevel = { distance: number; primitiveType: number; vertexBuffer: number; indexBuffer: number; indexStart: number; indexCount: number };
type Geometry = { boneMapping: number[]; lodLevels: LodLevel[] };
type Bone = { name: string; parentIndex: number };
type MdlModel = { fileId: string; vertexBuffers: VertexBuffer[]; indexBuffers: IndexBuffer[]; geometries: Geometry[]; morphCount: number; bones: Bone[]; boundingBox: { min: Vec3; max: Vec3 }; geometryCenters: Vec3[] };
type Vec3 = [number, number, number];

export type MdlInfo = ReturnType<typeof summarizeModel>;
export type MdlToGltfResult = {
  gltfRelativePath: string;
  binRelativePath: string;
  info: MdlInfo;
  material?: ResolvedMdlMaterial;
  stats: { meshes: number; primitives: number; vertices: number; triangles: number; skippedGeometries: number };
};

type TextureReference = { unit?: string; name?: string };
type ResolvedMdlMaterial = {
  materialRelativePath: string;
  textureRelativePath?: string;
  textureUuid?: string;
  textureUnit?: string;
  baseColorFactor?: [number, number, number, number];
  metallicFactor?: number;
  roughnessFactor?: number;
  warnings: string[];
};

class Reader {
  private offset = 0;
  constructor(private readonly data: Buffer) {}
  eof() { return this.offset >= this.data.length; }
  read(size: number) {
    if (this.offset + size > this.data.length) throw new Error(`Unexpected end of MDL at offset ${this.offset}`);
    const out = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return out;
  }
  skip(size: number) { this.read(size); }
  u8() { const value = this.data.readUInt8(this.offset); this.offset += 1; return value; }
  u32() { const value = this.data.readUInt32LE(this.offset); this.offset += 4; return value; }
  i32() { const value = this.data.readInt32LE(this.offset); this.offset += 4; return value; }
  f32() { const value = this.data.readFloatLE(this.offset); this.offset += 4; return value; }
  vec3(): Vec3 { return [this.f32(), this.f32(), this.f32()]; }
  string() {
    const start = this.offset;
    while (this.offset < this.data.length && this.data[this.offset] !== 0) this.offset += 1;
    if (this.offset >= this.data.length) throw new Error(`Unterminated string at offset ${start}`);
    const out = this.data.subarray(start, this.offset).toString("utf8");
    this.offset += 1;
    return out;
  }
}

function buildElements(raw: Array<[number, number, number]>): VertexElement[] {
  let offset = 0;
  return raw.map(([elementType, semantic, index]) => {
    const size = TYPE_SIZES[elementType];
    if (!size) throw new Error(`Unsupported vertex element type: ${elementType}`);
    const element = { elementType, semantic, index, offset, size };
    offset += size;
    return element;
  });
}

function parseMdl(data: Buffer): MdlModel {
  const reader = new Reader(data);
  const fileId = reader.read(4).toString("ascii");
  if (fileId !== "UMDL" && fileId !== "UMD2") throw new Error(`Unsupported MDL file id: ${fileId}`);
  const hasDeclarations = fileId === "UMD2";

  const vertexBuffers: VertexBuffer[] = [];
  for (let i = 0, count = reader.u32(); i < count; i += 1) {
    const vertexCount = reader.u32();
    const rawElements: Array<[number, number, number]> = [];
    if (hasDeclarations) {
      for (let j = 0, elementCount = reader.u32(); j < elementCount; j += 1) {
        const desc = reader.u32();
        rawElements.push([desc & 0xff, (desc >> 8) & 0xff, (desc >> 16) & 0xff]);
      }
    } else {
      const mask = reader.u32();
      rawElements.push(...LEGACY_ELEMENTS.filter((_, bit) => (mask & (1 << bit)) !== 0));
    }
    const elements = buildElements(rawElements);
    const vertexSize = elements.reduce((sum, element) => sum + element.size, 0);
    const morphRangeStart = reader.u32();
    const morphRangeCount = reader.u32();
    vertexBuffers.push({ vertexCount, vertexSize, elements, morphRangeStart, morphRangeCount, data: reader.read(vertexCount * vertexSize) });
  }

  const indexBuffers: IndexBuffer[] = [];
  for (let i = 0, count = reader.u32(); i < count; i += 1) {
    const indexCount = reader.u32();
    const indexSize = reader.u32();
    if (indexSize !== 2 && indexSize !== 4) throw new Error(`Unsupported index size: ${indexSize}`);
    indexBuffers.push({ indexCount, indexSize, data: reader.read(indexCount * indexSize) });
  }

  const geometries: Geometry[] = [];
  for (let i = 0, count = reader.u32(); i < count; i += 1) {
    const boneMapping = Array.from({ length: reader.u32() }, () => reader.u32());
    const lodLevels = Array.from({ length: reader.u32() }, () => ({
      distance: reader.f32(),
      primitiveType: reader.u32(),
      vertexBuffer: reader.u32(),
      indexBuffer: reader.u32(),
      indexStart: reader.u32(),
      indexCount: reader.u32()
    }));
    geometries.push({ boneMapping, lodLevels });
  }

  const morphCount = reader.u32();
  for (let i = 0; i < morphCount; i += 1) {
    reader.string();
    for (let j = 0, bufferCount = reader.u32(); j < bufferCount; j += 1) {
      reader.u32();
      const mask = reader.u32();
      const vertexCount = reader.u32();
      let vertexSize = 4;
      if ((mask & 0x1) !== 0) vertexSize += 12;
      if ((mask & 0x2) !== 0) vertexSize += 12;
      if ((mask & 0x80) !== 0) vertexSize += 12;
      reader.skip(vertexCount * vertexSize);
    }
  }

  const bones = Array.from({ length: reader.i32() }, () => {
    const name = reader.string();
    const parentIndex = reader.i32();
    reader.skip(12 + 16 + 12 + 48);
    const collisionMask = reader.u8();
    if ((collisionMask & 0x1) !== 0) reader.skip(4);
    if ((collisionMask & 0x2) !== 0) reader.skip(24);
    return { name, parentIndex };
  });
  const boundingBox = { min: reader.vec3(), max: reader.vec3() };
  const geometryCenters: Vec3[] = [];
  for (let i = 0; i < geometries.length && !reader.eof(); i += 1) geometryCenters.push(reader.vec3());
  while (geometryCenters.length < geometries.length) geometryCenters.push([0, 0, 0]);
  return { fileId, vertexBuffers, indexBuffers, geometries, morphCount, bones, boundingBox, geometryCenters };
}

function summarizeModel(model: MdlModel) {
  return {
    fileId: model.fileId,
    vertexBuffers: model.vertexBuffers.map((buffer) => ({
      vertexCount: buffer.vertexCount,
      vertexSize: buffer.vertexSize,
      morphRangeStart: buffer.morphRangeStart,
      morphRangeCount: buffer.morphRangeCount,
      elements: buffer.elements.map((element) => ({
        type: TYPE_NAMES[element.elementType] ?? String(element.elementType),
        semantic: SEMANTIC_NAMES[element.semantic] ?? String(element.semantic),
        index: element.index,
        offset: element.offset,
        size: element.size,
        raw: { type: element.elementType, semantic: element.semantic, index: element.index }
      }))
    })),
    indexBuffers: model.indexBuffers.map((buffer) => ({ indexCount: buffer.indexCount, indexSize: buffer.indexSize })),
    geometries: model.geometries.map((geometry) => ({
      boneMappingCount: geometry.boneMapping.length,
      lodLevels: geometry.lodLevels.map((lod) => ({
        distance: lod.distance,
        primitiveType: PRIMITIVE_NAMES[lod.primitiveType] ?? String(lod.primitiveType),
        vertexBuffer: lod.vertexBuffer,
        indexBuffer: lod.indexBuffer,
        indexStart: lod.indexStart,
        indexCount: lod.indexCount
      }))
    })),
    morphCount: model.morphCount,
    boneCount: model.bones.length,
    bones: model.bones,
    boundingBox: model.boundingBox,
    geometryCenters: model.geometryCenters
  };
}

function findElement(buffer: VertexBuffer, semantic: number, index = 0) {
  return buffer.elements.find((element) => element.semantic === semantic && element.index === index);
}

function readTuple(buffer: VertexBuffer, vertexIndex: number, element: VertexElement) {
  const offset = vertexIndex * buffer.vertexSize + element.offset;
  if (element.elementType === 2) return [buffer.data.readFloatLE(offset), buffer.data.readFloatLE(offset + 4)];
  if (element.elementType === 3) return [buffer.data.readFloatLE(offset), buffer.data.readFloatLE(offset + 4), buffer.data.readFloatLE(offset + 8)];
  if (element.elementType === 4) return [buffer.data.readFloatLE(offset), buffer.data.readFloatLE(offset + 4), buffer.data.readFloatLE(offset + 8), buffer.data.readFloatLE(offset + 12)];
  throw new Error(`Unsupported exported vertex element type: ${element.elementType}`);
}

function readIndices(buffer: IndexBuffer) {
  const indices: number[] = [];
  for (let offset = 0; offset < buffer.data.length; offset += buffer.indexSize) {
    indices.push(buffer.indexSize === 2 ? buffer.data.readUInt16LE(offset) : buffer.data.readUInt32LE(offset));
  }
  return indices;
}

function appendAccessor(chunks: Buffer[], length: { value: number }, views: any[], accessors: any[], data: Buffer, accessor: any, target?: number) {
  const padding = length.value % 4 === 0 ? 0 : 4 - (length.value % 4);
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    length.value += padding;
  }
  const byteOffset = length.value;
  chunks.push(data);
  length.value += data.length;
  views.push({ buffer: 0, byteOffset, byteLength: data.length, ...(target ? { target } : {}) });
  accessors.push({ ...accessor, bufferView: views.length - 1 });
  return accessors.length - 1;
}

function vec3Bounds(values: number[][]) {
  return {
    min: [Math.min(...values.map((v) => v[0])), Math.min(...values.map((v) => v[1])), Math.min(...values.map((v) => v[2]))],
    max: [Math.max(...values.map((v) => v[0])), Math.max(...values.map((v) => v[1])), Math.max(...values.map((v) => v[2]))]
  };
}

function listFilesRecursive(dir: string, predicate: (filePath: string) => boolean, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(fullPath, predicate, out);
    else if (predicate(fullPath)) out.push(fullPath);
  }
  return out;
}

function toProjectRelative(projectRoot: string, absolutePath: string) {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
}

function parseXmlAttributes(tag: string) {
  const attrs = new Map<string, string>();
  for (const match of tag.matchAll(/([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g)) attrs.set(match[1], match[2]);
  return attrs;
}

function parseTextureReferences(materialXml: string): TextureReference[] {
  return [...materialXml.matchAll(/<texture\b[^>]*\/?>/gi)].map((match) => {
    const attrs = parseXmlAttributes(match[0]);
    return { unit: attrs.get("unit"), name: attrs.get("name") };
  });
}

function parseMaterialParameter(materialXml: string, name: string) {
  for (const match of materialXml.matchAll(/<parameter\b[^>]*\/?>/gi)) {
    const attrs = parseXmlAttributes(match[0]);
    if (attrs.get("name") === name) return attrs.get("value");
  }
  return undefined;
}

function parseNumberList(value: string | undefined) {
  if (!value) return undefined;
  const numbers = value.trim().split(/\s+/).map(Number);
  return numbers.every((number) => Number.isFinite(number)) ? numbers : undefined;
}

function imageMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function buildTextureUuidIndex(projectRoot: string) {
  const index = new Map<string, string>();
  const textureRoot = path.join(projectRoot, "assets", "Textures");
  const metaFiles = listFilesRecursive(textureRoot, (filePath) => filePath.endsWith(".meta"));
  for (const metaPath of metaFiles) {
    const assetPath = metaPath.slice(0, -".meta".length);
    if (!/\.(jpe?g|png|webp)$/i.test(assetPath) || !fs.existsSync(assetPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (typeof data.uuid === "string" && data.uuid) index.set(data.uuid, assetPath);
    } catch {
      // Ignore broken sidecar metadata; the converter can still fall back to an untextured preview.
    }
  }
  return index;
}

function resolveTexturePath(projectRoot: string, textureName: string | undefined, textureUuidIndex: Map<string, string>) {
  if (!textureName) return undefined;
  if (textureName.startsWith("uuid://")) return textureUuidIndex.get(textureName.slice("uuid://".length));

  const normalized = textureName.replace(/\\/g, "/").replace(/^\/+/, "");
  const possibleRelativePaths = normalized.startsWith("assets/")
    ? [normalized]
    : [`assets/${normalized}`, normalized];
  for (const relativePath of possibleRelativePaths) {
    const fullPath = path.resolve(projectRoot, relativePath);
    if (fullPath.startsWith(`${path.resolve(projectRoot)}${path.sep}`) && fs.existsSync(fullPath)) return fullPath;
  }
  return undefined;
}

function resolveMdlMaterial(projectRoot: string, mdlRelativePath: string): ResolvedMdlMaterial | undefined {
  const mdlBase = path.basename(mdlRelativePath, path.extname(mdlRelativePath));
  const materialsRoot = path.join(projectRoot, "assets", "Materials");
  const materialPath = listFilesRecursive(
    materialsRoot,
    (filePath) => filePath.toLowerCase().endsWith(".xml") && path.basename(filePath, ".xml").startsWith(mdlBase)
  ).sort((a, b) => a.localeCompare(b))[0];
  if (!materialPath) return undefined;

  const warnings: string[] = [];
  const materialXml = fs.readFileSync(materialPath, "utf8");
  const textureRefs = parseTextureReferences(materialXml);
  const textureRef = textureRefs.find((ref) => ref.unit === "diffuse") ?? textureRefs[0];
  const textureUuid = textureRef?.name?.startsWith("uuid://") ? textureRef.name.slice("uuid://".length) : undefined;
  const texturePath = resolveTexturePath(projectRoot, textureRef?.name, buildTextureUuidIndex(projectRoot));

  if (textureRef?.name && !texturePath) warnings.push(`Texture not found: ${textureRef.name}`);
  if (!textureRef?.name) warnings.push("Material has no texture reference");

  const baseColor = parseNumberList(parseMaterialParameter(materialXml, "MatDiffColor"));
  const metallic = Number(parseMaterialParameter(materialXml, "Metallic"));
  const roughness = Number(parseMaterialParameter(materialXml, "Roughness"));

  return {
    materialRelativePath: toProjectRelative(projectRoot, materialPath),
    ...(texturePath ? { textureRelativePath: toProjectRelative(projectRoot, texturePath) } : {}),
    ...(textureUuid ? { textureUuid } : {}),
    ...(textureRef?.unit ? { textureUnit: textureRef.unit } : {}),
    ...(baseColor && baseColor.length >= 4 ? { baseColorFactor: [baseColor[0], baseColor[1], baseColor[2], baseColor[3]] } : {}),
    ...(Number.isFinite(metallic) ? { metallicFactor: metallic } : {}),
    ...(Number.isFinite(roughness) ? { roughnessFactor: roughness } : {}),
    warnings
  };
}

export function inspectMdlFile(absolutePath: string) {
  return summarizeModel(parseMdl(fs.readFileSync(absolutePath)));
}

export function convertMdlToGltf(projectRoot: string, mdlRelativePath: string): MdlToGltfResult {
  const root = path.resolve(projectRoot);
  const mdlPath = path.resolve(projectRoot, mdlRelativePath);
  if (mdlPath !== root && !mdlPath.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe MDL path: ${mdlRelativePath}`);
  if (!fs.existsSync(mdlPath)) throw new Error(`MDL file not found: ${mdlRelativePath}`);

  const model = parseMdl(fs.readFileSync(mdlPath));
  const outDir = path.join(projectRoot, "assets", "model", "maker_plus", "converted");
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.basename(mdlRelativePath, path.extname(mdlRelativePath)).replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, "_");
  const gltfPath = path.join(outDir, `${baseName}.gltf`);
  const binPath = path.join(outDir, `${baseName}.bin`);

  const chunks: Buffer[] = [];
  const byteLength = { value: 0 };
  const bufferViews: any[] = [];
  const accessors: any[] = [];
  const meshes: any[] = [];
  const nodes: any[] = [];
  const resolvedMaterial = resolveMdlMaterial(projectRoot, mdlRelativePath);
  const gltfImages: any[] = [];
  const gltfTextures: any[] = [];
  const gltfMaterials: any[] = [];

  if (resolvedMaterial) {
    const material: any = {
      name: path.basename(resolvedMaterial.materialRelativePath, ".xml"),
      pbrMetallicRoughness: {
        baseColorFactor: resolvedMaterial.baseColorFactor ?? [1, 1, 1, 1],
        metallicFactor: resolvedMaterial.metallicFactor ?? 0,
        roughnessFactor: resolvedMaterial.roughnessFactor ?? 1
      }
    };
    if (resolvedMaterial.textureRelativePath) {
      const texturePath = path.join(projectRoot, resolvedMaterial.textureRelativePath);
      const textureData = fs.readFileSync(texturePath);
      gltfImages.push({ uri: `data:${imageMimeType(texturePath)};base64,${textureData.toString("base64")}` });
      gltfTextures.push({ source: 0 });
      material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    }
    gltfMaterials.push(material);
  }
  let skippedGeometries = 0;
  let triangles = 0;
  let vertices = 0;

  model.geometries.forEach((geometry, geometryIndex) => {
    const lod = geometry.lodLevels[0];
    const vb = lod ? model.vertexBuffers[lod.vertexBuffer] : undefined;
    const ib = lod ? model.indexBuffers[lod.indexBuffer] : undefined;
    const positionElement = vb ? findElement(vb, 0) : undefined;
    if (!lod || lod.primitiveType !== 0 || !vb || !ib || !positionElement) {
      skippedGeometries += 1;
      return;
    }
    const normalElement = findElement(vb, 1);
    const uvElement = findElement(vb, 4);
    const indices = readIndices(ib).slice(lod.indexStart, lod.indexStart + lod.indexCount);
    const used = [...new Set(indices)].sort((a, b) => a - b);
    const remap = new Map(used.map((sourceIndex, compactIndex) => [sourceIndex, compactIndex]));
    const positions = used.map((index) => readTuple(vb, index, positionElement));
    const bounds = vec3Bounds(positions);
    const attrs: Record<string, number> = {};
    attrs.POSITION = appendAccessor(chunks, byteLength, bufferViews, accessors, Buffer.concat(positions.map((value) => {
      const out = Buffer.alloc(12);
      out.writeFloatLE(value[0], 0); out.writeFloatLE(value[1], 4); out.writeFloatLE(value[2], 8);
      return out;
    })), { componentType: 5126, count: positions.length, type: "VEC3", min: bounds.min, max: bounds.max }, 34962);

    if (normalElement) {
      const normals = used.map((index) => readTuple(vb, index, normalElement));
      attrs.NORMAL = appendAccessor(chunks, byteLength, bufferViews, accessors, Buffer.concat(normals.map((value) => {
        const out = Buffer.alloc(12);
        out.writeFloatLE(value[0], 0); out.writeFloatLE(value[1], 4); out.writeFloatLE(value[2], 8);
        return out;
      })), { componentType: 5126, count: normals.length, type: "VEC3" }, 34962);
    }
    if (uvElement) {
      const uvs = used.map((index) => readTuple(vb, index, uvElement));
      attrs.TEXCOORD_0 = appendAccessor(chunks, byteLength, bufferViews, accessors, Buffer.concat(uvs.map((value) => {
        const out = Buffer.alloc(8);
        out.writeFloatLE(value[0], 0); out.writeFloatLE(value[1], 4);
        return out;
      })), { componentType: 5126, count: uvs.length, type: "VEC2" }, 34962);
    }

    const compactIndices = indices.map((index) => {
      const mapped = remap.get(index);
      if (mapped === undefined) throw new Error(`Index remap failed for ${index}`);
      return mapped;
    });
    const useU16 = Math.max(...compactIndices) <= 65535;
    const indexData = Buffer.alloc(compactIndices.length * (useU16 ? 2 : 4));
    compactIndices.forEach((index, offset) => {
      if (useU16) indexData.writeUInt16LE(index, offset * 2);
      else indexData.writeUInt32LE(index, offset * 4);
    });
    const indexAccessor = appendAccessor(chunks, byteLength, bufferViews, accessors, indexData, { componentType: useU16 ? 5123 : 5125, count: compactIndices.length, type: "SCALAR" }, 34963);
    meshes.push({
      name: `geometry_${geometryIndex}`,
      primitives: [{ attributes: attrs, indices: indexAccessor, mode: 4, ...(gltfMaterials.length ? { material: 0 } : {}) }]
    });
    nodes.push({ name: `geometry_${geometryIndex}`, mesh: meshes.length - 1 });
    triangles += Math.floor(indices.length / 3);
    vertices += positions.length;
  });

  const binary = Buffer.concat(chunks);
  fs.writeFileSync(binPath, binary);
  fs.writeFileSync(gltfPath, JSON.stringify({
    asset: { version: "2.0", generator: "TapTap Maker Plus MDL converter" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    buffers: [{ uri: `data:application/octet-stream;base64,${binary.toString("base64")}`, byteLength: binary.length }],
    bufferViews,
    accessors,
    ...(gltfImages.length ? { images: gltfImages } : {}),
    ...(gltfTextures.length ? { textures: gltfTextures } : {}),
    ...(gltfMaterials.length ? { materials: gltfMaterials } : {})
  }, null, 2), "utf8");

  return {
    gltfRelativePath: path.relative(projectRoot, gltfPath).replace(/\\/g, "/"),
    binRelativePath: path.relative(projectRoot, binPath).replace(/\\/g, "/"),
    info: summarizeModel(model),
    ...(resolvedMaterial ? { material: resolvedMaterial } : {}),
    stats: { meshes: meshes.length, primitives: meshes.length, vertices, triangles, skippedGeometries }
  };
}
