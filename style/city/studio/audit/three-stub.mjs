// CHARACTER AUDIT · a stand-in for 'three' under node: chars.js only builds materials at import time; the audit calls compose(), never build().
class Any { constructor(o) { if (o && typeof o === 'object') Object.assign(this, o); } }
export class MeshStandardMaterial extends Any {} export class MeshBasicMaterial extends Any {} export class Color extends Any { setHex() { return this; } }
export class Group extends Any {} export class Mesh extends Any {} export class BufferGeometry extends Any {} export class Float32BufferAttribute extends Any {}
export class Vector4 extends Any {} export class Vector3 extends Any {} export class Matrix3 extends Any {} export class DataTexture extends Any {}
export const RGBAFormat = 0, FloatType = 0;
