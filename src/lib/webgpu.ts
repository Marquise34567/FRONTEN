export type WebGpuVideoDraw = {
  src: { x: number; y: number; w: number; h: number };
  dst: { x: number; y: number; w: number; h: number };
};

export type WebGpuVideoRenderer = {
  resize: (width: number, height: number) => void;
  draw: (
    video: HTMLVideoElement,
    draws: WebGpuVideoDraw[],
    sourceSize: { width: number; height: number },
  ) => boolean;
  dispose: () => void;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const buildVertexData = (
  draws: WebGpuVideoDraw[],
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
) => {
  const data = new Float32Array(draws.length * 6 * 4);
  let offset = 0;
  for (const draw of draws) {
    const sx = draw.src.x;
    const sy = draw.src.y;
    const sw = draw.src.w;
    const sh = draw.src.h;
    const dx = draw.dst.x;
    const dy = draw.dst.y;
    const dw = draw.dst.w;
    const dh = draw.dst.h;
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
    const u0 = clamp01(sx / sourceWidth);
    const v0 = clamp01(sy / sourceHeight);
    const u1 = clamp01((sx + sw) / sourceWidth);
    const v1 = clamp01((sy + sh) / sourceHeight);
    const left = (dx / canvasWidth) * 2 - 1;
    const right = ((dx + dw) / canvasWidth) * 2 - 1;
    const top = 1 - (dy / canvasHeight) * 2;
    const bottom = 1 - ((dy + dh) / canvasHeight) * 2;

    data[offset++] = left;
    data[offset++] = top;
    data[offset++] = u0;
    data[offset++] = v0;

    data[offset++] = right;
    data[offset++] = top;
    data[offset++] = u1;
    data[offset++] = v0;

    data[offset++] = left;
    data[offset++] = bottom;
    data[offset++] = u0;
    data[offset++] = v1;

    data[offset++] = left;
    data[offset++] = bottom;
    data[offset++] = u0;
    data[offset++] = v1;

    data[offset++] = right;
    data[offset++] = top;
    data[offset++] = u1;
    data[offset++] = v0;

    data[offset++] = right;
    data[offset++] = bottom;
    data[offset++] = u1;
    data[offset++] = v1;
  }
  return data;
};

export const createWebGpuVideoRenderer = async (
  canvas: HTMLCanvasElement,
): Promise<WebGpuVideoRenderer | null> => {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { gpu?: GPU };
  if (!nav.gpu) return null;
  const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;

  const format = nav.gpu.getPreferredCanvasFormat();
  let configured = false;
  let configuredWidth = 0;
  let configuredHeight = 0;
  let lost = false;

  device.lost
    .then(() => {
      lost = true;
    })
    .catch(() => {
      lost = true;
    });

  const shaderModule = device.createShaderModule({
    code: `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@location(0) position: vec2f, @location(1) uv: vec2f) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4f(position, 0.0, 1.0);
  out.uv = uv;
  return out;
}

@group(0) @binding(0) var sampler0: sampler;
@group(0) @binding(1) var videoTex: texture_external;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(videoTex, sampler0, uv);
}
`,
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x2" },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  let vertexBuffer: GPUBuffer | null = null;
  let vertexCapacity = 0;

  const ensureConfigured = (width: number, height: number) => {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    if (!configured || configuredWidth !== nextWidth || configuredHeight !== nextHeight) {
      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
      });
      configured = true;
      configuredWidth = nextWidth;
      configuredHeight = nextHeight;
    }
  };

  const ensureVertexCapacity = (vertexCount: number) => {
    const byteLength = vertexCount * 4 * 4;
    if (!vertexBuffer || byteLength > vertexCapacity) {
      vertexBuffer?.destroy?.();
      const nextCapacity = Math.max(byteLength, 6 * 4 * 4 * 4);
      vertexBuffer = device.createBuffer({
        size: nextCapacity,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      vertexCapacity = nextCapacity;
    }
  };

  const draw = (
    video: HTMLVideoElement,
    draws: WebGpuVideoDraw[],
    sourceSize: { width: number; height: number },
  ) => {
    if (lost) return false;
    if (!draws.length) return false;
    if (!Number.isFinite(sourceSize.width) || !Number.isFinite(sourceSize.height)) return false;
    const sourceWidth = Math.max(1, sourceSize.width);
    const sourceHeight = Math.max(1, sourceSize.height);
    const canvasWidth = Math.max(1, canvas.width);
    const canvasHeight = Math.max(1, canvas.height);

    const vertexCount = draws.length * 6;
    ensureVertexCapacity(vertexCount);
    if (!vertexBuffer) return false;

    const data = buildVertexData(draws, canvasWidth, canvasHeight, sourceWidth, sourceHeight);
    device.queue.writeBuffer(vertexBuffer, 0, data.buffer, data.byteOffset, data.byteLength);

    let externalTexture: GPUExternalTexture;
    try {
      externalTexture = device.importExternalTexture({ source: video });
    } catch {
      return false;
    }

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: externalTexture },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.015, g: 0.015, b: 0.015, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertexCount, 1, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);
    return true;
  };

  return {
    resize: ensureConfigured,
    draw,
    dispose: () => {
      vertexBuffer?.destroy?.();
      vertexBuffer = null;
    },
  };
};
