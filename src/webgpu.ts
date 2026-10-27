import { GPUAtmosphere } from "./gpu-atmosphere";
// Phaser 3 continues to render gameplay. This optional, real WebGPU compositor
// adds HDR bloom and atmospheric refraction without replacing its collision engine.
const shader = /* wgsl */ `
struct Frame { time: f32, aspect: f32, region: f32, reduced: f32,
  player: vec2f, attack: f32, dash: f32, resolution: vec2f, strength: f32, pad: f32,
  action:vec4f, enemy:vec4f, }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var light: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var<uniform> frame: Frame;
@group(0) @binding(4) var wideLight: texture_2d<f32>;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f, }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var v: Vertex; v.position = vec4f(p[index],0,1); v.uv = vec2f(p[index].x*.5+.5,.5-p[index].y*.5); return v;
}
fn luminance(c: vec3f) -> f32 {return dot(c,vec3f(.2126,.7152,.0722));}
fn linear(c:vec3f)->vec3f{return pow(max(c,vec3f(0)),vec3f(2.2));}
@fragment fn extract(v: Vertex) -> @location(0) vec4f {
  let c = textureSample(source,linearSampler,v.uv).rgb;
  let knee = smoothstep(.56,.93,luminance(c));
  return vec4f(linear(c)*knee,1);
}
fn blur(uv: vec2f, axis: vec2f) -> vec4f {
  let delta = axis / vec2f(textureDimensions(light));
  var c = textureSample(light,linearSampler,uv)*.227027;
  c += textureSample(light,linearSampler,uv+delta*1.384615)*.316216;
  c += textureSample(light,linearSampler,uv-delta*1.384615)*.316216;
  c += textureSample(light,linearSampler,uv+delta*3.230769)*.070270;
  c += textureSample(light,linearSampler,uv-delta*3.230769)*.070270;
  return c;
}
@fragment fn horizontal(v: Vertex) -> @location(0) vec4f {return blur(v.uv,vec2f(1,0));}
@fragment fn vertical(v: Vertex) -> @location(0) vec4f {return blur(v.uv,vec2f(0,1));}
@fragment fn wider(v: Vertex) -> @location(0) vec4f {return blur(v.uv,vec2f(3,0));}
@fragment fn compose(v: Vertex) -> @location(0) vec4f {
  let uv=v.uv;
  let motion=1-frame.reduced;
  let t=frame.time*motion;
  let edge=smoothstep(.25,.8,abs(uv.x-.5));
  // Subpixel distortion belongs to the distant atmosphere, never the HTML UI.
  let ripple=sin(uv.y*34+t*.4)*sin(uv.x*16-t*.3);
  let warp=vec2f(ripple*.45/frame.resolution.x,sin(uv.x*25+t*.5)*.25/frame.resolution.y)*motion*edge;
  let sampleUV=uv+warp;
  var c=textureSample(source,linearSampler,sampleUV).rgb;
  let glow=textureSample(light,linearSampler,uv).rgb;
  let wide=textureSample(wideLight,linearSampler,uv).rgb;
  let bloom=(glow*.72+wide*.4)*frame.strength;
  // Scatter light in linear space, preserving saturated glass and the dark ink silhouette.
  let base=linear(c);
  let energy=base+bloom*.32*(1.-base*.65);
  c=pow(clamp(energy,vec3f(0),vec3f(1)),vec3f(1./2.2));
  // Prismatic highlights, softened by the source luminance to preserve silhouettes.
  let prism=textureSample(source,linearSampler,sampleUV+vec2f(.65/frame.resolution.x,0)).r-
            textureSample(source,linearSampler,sampleUV-vec2f(.65/frame.resolution.x,0)).r;
  c+=vec3f(prism*.13,-abs(prism)*.025,-prism*.12);
  let haze=smoothstep(.4,1.,uv.y)*.018*(.5+.5*sin(uv.x*8+t*.09));
  let fog=select(vec3f(.68,.82,.79),vec3f(.73,.62,.82),frame.region>1.5);
  c=mix(c,fog,haze);
  // Screen-space shafts scatter in the painted haze, suppressed over dark rock.
  let ray=pow(max(0.,sin((uv.x+uv.y*.23)*38.+sin(uv.y*5.+t*.07)*.5)),14.);
  let rayMask=smoothstep(.15,.45,uv.y)*(1.-smoothstep(.72,1.,uv.y))*smoothstep(.18,.64,luminance(c));
  var rayColor=vec3f(.96,.81,.53);
  if(frame.region>.5){rayColor=vec3f(.55,.77,1.);}
  if(frame.region>1.5){rayColor=vec3f(1.,.66,.81);}
  c+=rayColor*ray*rayMask*.034;
  // Twelve occlusion samples gather painted highlights into a localized sun veil.
  // This is screen-space scattering; dark foreground suppresses it without inventing geometry.
  let sun=vec2f(select(.73,.62,frame.region>1.5),.14);
  let delta=(sun-uv)/12.;
  var shaft=vec3f(0);var weight=1.;
  for(var n=0;n<12;n++){
    let at=uv+delta*(f32(n)+.5);
    let sample=textureSampleLevel(source,linearSampler,at,0.).rgb;
    shaft+=linear(sample)*smoothstep(.63,.96,luminance(sample))*weight;
    weight*=.88;
  }
  let sunDistance=length((uv-sun)*vec2f(frame.aspect,1.));
  let silhouette=smoothstep(.17,.5,luminance(c));
  c+=shaft/12.*rayColor*.14*silhouette*(1.-smoothstep(.2,1.2,sunDistance));
  // Fine spectral caustics stay in bright lower haze, away from the player's outline.
  let cell=vec2f(uv.x*frame.aspect,uv.y)*16.;
  let wave=sin(cell.x*2.7+t*.14)+sin(cell.y*3.1-t*.18)+sin((cell.x+cell.y)*1.7+t*.11);
  let lace=exp(-abs(wave)*18.);
  let focusDistance=length((uv-frame.player)*vec2f(frame.aspect,1.));
  c+=rayColor*lace*.017*smoothstep(.55,.95,uv.y)*silhouette*smoothstep(.06,.15,focusDistance);
  let caustic=pow(max(0.,sin(uv.x*43.+t*.18)*sin(uv.y*57.-t*.13)),12.);
  c+=rayColor*caustic*smoothstep(.58,1.,uv.y)*smoothstep(.22,.65,luminance(c))*.018;
  let p=(uv-frame.player)*vec2f(frame.aspect,1);
  let distance=length(p);
  // Local lantern bounce: source-gradient rim light is a stylized material response.
  // It deliberately avoids relighting the porcelain face at the center of the focus.
  let pixel=vec2f(2.)/frame.resolution;
  let gx=luminance(textureSample(source,linearSampler,uv+vec2f(pixel.x,0)).rgb)-
    luminance(textureSample(source,linearSampler,uv-vec2f(pixel.x,0)).rgb);
  let gy=luminance(textureSample(source,linearSampler,uv+vec2f(0,pixel.y)).rgb)-
    luminance(textureSample(source,linearSampler,uv-vec2f(0,pixel.y)).rgb);
  let gradient=vec2f(gx,gy);
  let facingLight=max(0.,dot(gradient,-p/max(distance,.001)));
  let lantern=exp(-distance*distance*95.);
  c+=vec3f(1.,.83,.48)*lantern*(facingLight*.19+smoothstep(.12,.5,luminance(c))*.012)*smoothstep(.022,.055,distance);
  let wake=vec2f(p.x*frame.action.x,p.y);
  let dashVeil=exp(-pow((wake.x+.06)*8.,2.)-pow(wake.y*48.,2.))*
    smoothstep(.035,.06,abs(wake.x))*frame.dash*motion;
  c+=vec3f(.28,.65,.58)*dashVeil*.09;
  let bindPhase=frame.action.w;
  let bindDistance=length((uv-frame.action.yz)*vec2f(frame.aspect,1));
  let bindRing=exp(-pow((bindDistance-(.025+bindPhase*.065))*190.,2.))*
    sin(bindPhase*3.14159265)*select(0.,1.,bindPhase>0.&&bindPhase<1.)*motion;
  c+=vec3f(.53,.72,.3)*bindRing*.13;
  let enemyDistance=length((uv-frame.enemy.xy)*vec2f(frame.aspect,1.));
  let warning=max(0.,frame.enemy.z);
  let impact=max(0.,-frame.enemy.z);
  let warningRing=exp(-pow((enemyDistance-(.048-warning*.01))*240.,2.));
  let impactLight=exp(-enemyDistance*enemyDistance*1400.);
  c+=vec3f(1.,.5,.2)*warningRing*warning*.055;
  c+=vec3f(.68,.9,.7)*impactLight*impact*.07*motion;
  let ring=exp(-pow((distance-(.018+frame.attack*.13))*130.,2.)) *
    sin(frame.attack*3.14159265)*select(0.,1.,frame.attack>0.&&frame.attack<1.)*motion;
  c+=vec3f(.42,.67,.56)*ring*.1;
  // Filmic shoulder avoids clipping luminous flowers to flat white.
  c=min(c,vec3f(1));
  return vec4f(c,1);
}`;

export interface GPUFrame {
  enemyX?: number;
  enemyY?: number;
  enemySignal?: number;
  facing?: number;
  bindX?: number;
  bindY?: number;
  bind?: number;
  viewX?: number;
  viewY?: number;
  viewWidth?: number;
  viewHeight?: number;
  time: number;
  region: number;
  reduced: boolean;
  playerX: number;
  playerY: number;
  attack: number;
  dash: number;
}
export class WebGPUCompositor {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  private canvas?: HTMLCanvasElement;
  private raw?: GPUTexture;
  private bloomA?: GPUTexture;
  private bloomB?: GPUTexture;
  private wideA?: GPUTexture;
  private wideB?: GPUTexture;
  private uniform?: GPUBuffer;
  private sampler?: GPUSampler;
  private atmosphere?: GPUAtmosphere;
  private pipelines: GPURenderPipeline[] = [];
  private groups: GPUBindGroup[] = [];
  private sourceWidth = 0;
  private sourceHeight = 0;
  private generation = 0;
  private active = false;
  private intentional = false;
  private values = new Float32Array(20);
  status = "尚未启用";
  constructor(
    private source: HTMLCanvasElement,
    private onFailure: (reason: string) => void,
  ) {}
  get enabled() {
    return this.active;
  }
  async enable(): Promise<boolean> {
    const generation = ++this.generation;
    this.dispose();
    if (!isSecureContext || !navigator.gpu) {
      this.status = "当前浏览器或访问地址不支持 WebGPU";
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) throw new Error("没有可用的 WebGPU 适配器");
      const device = await adapter.requestDevice();
      if (generation !== this.generation) {
        device.destroy();
        return false;
      }
      this.device = device;
      this.intentional = false;
      const canvas = document.createElement("canvas");
      canvas.id = "webgpu-view";
      canvas.setAttribute("aria-hidden", "true");
      this.source.parentElement!.append(canvas);
      this.canvas = canvas;
      const context = canvas.getContext("webgpu");
      if (!context) throw new Error("无法创建 WebGPU 画布");
      this.context = context;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "opaque" });
      const module = device.createShaderModule({
        label: "Dewlight dream compositor",
        code: shader,
      });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === "error");
      if (errors.length)
        throw new Error(errors.map((m) => m.message).join("; "));
      const layout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
          },
        ],
      });
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [layout],
      });
      this.pipelines = await Promise.all(
        [
          "extract",
          "horizontal",
          "vertical",
          "wider",
          "vertical",
          "compose",
        ].map((entryPoint, index) =>
          device.createRenderPipelineAsync({
            label: `Dream ${entryPoint}`,
            layout: pipelineLayout,
            vertex: { module, entryPoint: "vertex" },
            fragment: {
              module,
              entryPoint,
              targets: [{ format: index === 5 ? format : "rgba16float" }],
            },
            primitive: { topology: "triangle-list" },
          }),
        ),
      );
      if (generation !== this.generation) {
        this.dispose();
        return false;
      }
      this.uniform = device.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });
      this.sourceWidth = 0;
      this.atmosphere = new GPUAtmosphere(device, format);
      this.active = true;
      this.status = "WebGPU 已启用 · HDR 光晕 / 细微折射";
      device.addEventListener("uncapturederror", (event) => {
        event.preventDefault();
        if (this.device === device) this.fail(event.error.message);
      });
      void device.lost.then((info) => {
        if (!this.intentional && this.device === device)
          this.fail(info.message || "图形设备已断开");
      });
      return true;
    } catch (error) {
      this.status =
        error instanceof Error ? error.message : "WebGPU 初始化失败";
      this.dispose();
      return false;
    }
  }
  disable() {
    this.generation++;
    this.dispose();
    this.status = "兼容渲染";
  }
  private fail(reason: string) {
    if (!this.active) return;
    this.status = reason;
    this.dispose();
    this.onFailure(reason);
  }
  private dispose() {
    this.active = false;
    this.intentional = true;
    this.source.style.opacity = "";
    this.raw?.destroy();
    this.bloomA?.destroy();
    this.bloomB?.destroy();
    this.wideA?.destroy();
    this.wideB?.destroy();
    this.uniform?.destroy();
    this.atmosphere?.destroy();
    this.atmosphere = undefined;
    this.context?.unconfigure();
    this.canvas?.remove();
    this.device?.destroy();
    this.device = undefined;
    this.context = undefined;
    this.canvas = undefined;
    this.raw = undefined;
    this.bloomA = undefined;
    this.bloomB = undefined;
    this.wideA = undefined;
    this.wideB = undefined;
    this.pipelines = [];
    this.groups = [];
    this.sourceWidth = 0;
    this.sourceHeight = 0;
  }
  draw(frame: GPUFrame) {
    if (!this.active || !this.device || !this.context || !this.canvas) return;
    try {
      const d = this.device,
        w = this.source.width,
        h = this.source.height;
      if (!w || !h) return;
      if (w !== this.sourceWidth || h !== this.sourceHeight) {
        this.sourceWidth = w;
        this.sourceHeight = h;
        this.raw?.destroy();
        this.bloomA?.destroy();
        this.bloomB?.destroy();
        this.wideA?.destroy();
        this.wideB?.destroy();
        const scale = Math.min(1, 2560 / w, 1440 / h);
        this.canvas.width = Math.max(1, Math.floor(w * scale));
        this.canvas.height = Math.max(1, Math.floor(h * scale));
        this.raw = d.createTexture({
          size: [w, h],
          format: "rgba8unorm",
          usage:
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.atmosphere?.source(this.raw);
        const size = [
          Math.max(1, Math.ceil(this.canvas.width / 4)),
          Math.max(1, Math.ceil(this.canvas.height / 4)),
        ];
        const descriptor: GPUTextureDescriptor = {
          size,
          format: "rgba16float",
          usage:
            GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        };
        this.bloomA = d.createTexture(descriptor);
        this.bloomB = d.createTexture(descriptor);
        const wideSize = [
          Math.max(1, Math.ceil(this.canvas.width / 12)),
          Math.max(1, Math.ceil(this.canvas.height / 12)),
        ];
        this.wideA = d.createTexture({ ...descriptor, size: wideSize });
        this.wideB = d.createTexture({ ...descriptor, size: wideSize });
        this.groups = this.pipelines.map((pipeline, index) =>
          d.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: this.raw!.createView() },
              {
                binding: 1,
                resource: (index === 4
                  ? this.wideB!
                  : index === 2
                    ? this.bloomB!
                    : index === 0
                      ? this.bloomB!
                      : this.bloomA!
                ).createView(),
              },
              { binding: 2, resource: this.sampler! },
              { binding: 3, resource: { buffer: this.uniform! } },
              {
                binding: 4,
                resource: (index === 4
                  ? this.wideB!
                  : this.wideA!
                ).createView(),
              },
            ],
          }),
        );
      }
      this.values.set([
        frame.time,
        w / h,
        frame.region,
        Number(frame.reduced),
        frame.playerX,
        frame.playerY,
        frame.attack,
        frame.dash,
        w,
        h,
        0.9,
        0,
        frame.facing ?? 1,
        frame.bindX ?? frame.playerX,
        frame.bindY ?? frame.playerY,
        frame.bind ?? 1,
        frame.enemyX ?? -10,
        frame.enemyY ?? -10,
        frame.enemySignal ?? 0,
        0,
      ]);
      d.queue.writeBuffer(this.uniform!, 0, this.values);
      d.queue.copyExternalImageToTexture(
        { source: this.source },
        { texture: this.raw! },
        [w, h],
      );
      const encoder = d.createCommandEncoder();
      const output = this.context.getCurrentTexture().createView();
      const targets = [
        this.bloomA!,
        this.bloomB!,
        this.bloomA!,
        this.wideB!,
        this.wideA!,
        undefined,
      ];
      for (let n = 0; n < 6; n++) {
        const view = n === 5 ? output : targets[n]!.createView();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view,
              loadOp: "clear",
              storeOp: "store",
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });
        pass.setPipeline(this.pipelines[n]);
        pass.setBindGroup(0, this.groups[n]);
        pass.draw(3);
        pass.end();
      }
      this.atmosphere?.draw(
        encoder,
        output,
        frame,
        this.canvas.width,
        this.canvas.height,
      );
      d.queue.submit([encoder.finish()]);
      this.source.style.opacity = "0";
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "WebGPU 绘制失败");
    }
  }
}
