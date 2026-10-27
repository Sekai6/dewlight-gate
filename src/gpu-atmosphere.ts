// Analytic instancing keeps 768 world-anchored sprites entirely on the GPU.
// Positions depend on simulation time, so pause/reduced motion need no state reset.
const code = /* wgsl */ `
struct Frame { time:f32, aspect:f32, region:f32, reduced:f32,
 camera:vec2f, extent:vec2f, resolution:vec2f, player:vec2f, }
@group(0) @binding(0) var<uniform> f:Frame;
@group(0) @binding(1) var scene:texture_2d<f32>;
@group(0) @binding(2) var linearSampler:sampler;
struct V { @builtin(position) p:vec4f, @location(0) local:vec2f,
 @location(1) uv:vec2f, @location(2) seed:f32, @location(3) alpha:f32, }
fn hash(n:f32)->f32{return fract(sin(n*127.1+311.7)*43758.5453);}
@vertex fn vertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->V {
 let id=f32(instance);let seed=hash(id+7.);
 let depth=.25+hash(id+93.)*.7;
 let t=f.time*(1.-f.reduced);
 let tile=vec2f(2400.,1500.);
 let world=vec2f(hash(id+1.)*tile.x,hash(id+2.)*tile.y);
 let drift=vec2f(sin(t*.12+id)*18.+t*(2.+seed*5.),sin(t*.23+id*2.)*12.-t*(1.+seed*3.));
 let q=fract((world+drift-f.camera*depth)/tile)*tile;
 let center=q/f.extent;
 let corners=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
 let local=corners[vertex];
 let bokeh=select(0.,1.,seed>.96);
 let creature=seed>.91 && seed<.94;
 let radius=select(mix(1.3+hash(id+5.)*2.1,9.+seed*8.,bokeh),11.,creature);
 let flap=select(1.,.45+.55*abs(sin(t*2.+id)),creature);
 let offset=local*vec2f(flap,1.)*radius/f.resolution;
 let uv=center+offset;
 var v:V;v.p=vec4f(uv.x*2.-1.,1.-uv.y*2.,0.,1.);
 v.local=local;v.uv=uv;v.seed=seed;
 v.alpha=(.38+.26*sin(t*.7+id))*select(mix(.38,.08,bokeh),.4,creature);
 if(f.reduced>.5 && instance%8u!=0u){v.alpha=0.;}
 return v;
}
@fragment fn fragment(v:V)->@location(0) vec4f {
 let radius=length(v.local);if(radius>1.){discard;}
 let core=exp(-radius*radius*15.);
 let halo=pow(1.-radius,2.)*.24;
 let dew=exp(-pow((radius-.73)*16.,2.))*.45;
 var shape=select(core+halo,dew+halo*.25,v.seed>.96);
 if(v.seed>.91 && v.seed<.94){
   let wing=exp(-pow((abs(v.local.x)-.4)*3.8,2.)-pow((v.local.y+.18)*3.,2.));
   let lower=exp(-pow((abs(v.local.x)-.25)*6.,2.)-pow((v.local.y-.33)*5.,2.));
   let body=exp(-pow(v.local.x*17.,2.)-pow(v.local.y*2.,2.));
   shape=(wing*.65+lower*.45+body*.8);
   if(f.region>.5 && f.region<1.5){
     let diamond=abs(v.local.x)*1.2+abs(v.local.y);
     shape=exp(-pow((diamond-.6)*17.,2.))*.65+exp(-diamond*8.)*.4;
   }
 }
 let raw=textureSample(scene,linearSampler,v.uv).rgb;
 let luminance=dot(raw,vec3f(.2126,.7152,.0722));
 // Luminance is a screen-space visibility heuristic, not a depth buffer.
 let occlusion=smoothstep(.12,.43,luminance);
 let distance=length((v.uv-f.player)*vec2f(f.aspect,1.));
 let focus=smoothstep(.035,.11,distance);
 var color=vec3f(.85,1.,.71);
 if(f.region>.5){color=vec3f(.65,.84,1.);}
 if(f.region>1.5){color=vec3f(1.,.73,.86);}
 let a=shape*v.alpha*occlusion*focus;
 return vec4f(color*a,a);
}`;

export class GPUAtmosphere {
  private buffer: GPUBuffer;
  private pipeline: GPURenderPipeline;
  private sampler: GPUSampler;
  private group?: GPUBindGroup;
  private values = new Float32Array(12);
  constructor(
    private device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.buffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const module = device.createShaderModule({
      label: "World dew and firefly instancing",
      code,
    });
    this.pipeline = device.createRenderPipeline({
      label: "768 GPU dream motes",
      layout: "auto",
      vertex: { module, entryPoint: "vertex" },
      fragment: {
        module,
        entryPoint: "fragment",
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: "one", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
    this.sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
  }
  source(texture: GPUTexture) {
    this.group = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.buffer } },
        { binding: 1, resource: texture.createView() },
        { binding: 2, resource: this.sampler },
      ],
    });
  }
  draw(
    encoder: GPUCommandEncoder,
    target: GPUTextureView,
    frame: {
      time: number;
      region: number;
      reduced: boolean;
      playerX: number;
      playerY: number;
      viewX?: number;
      viewY?: number;
      viewWidth?: number;
      viewHeight?: number;
    },
    width: number,
    height: number,
  ) {
    if (!this.group) return;
    this.values.set([
      frame.time,
      width / height,
      frame.region,
      Number(frame.reduced),
      frame.viewX ?? 0,
      frame.viewY ?? 0,
      frame.viewWidth ?? 1440,
      frame.viewHeight ?? 900,
      width,
      height,
      frame.playerX,
      frame.playerY,
    ]);
    this.device.queue.writeBuffer(this.buffer, 0, this.values);
    const pass = encoder.beginRenderPass({
      label: "World-anchored dew sprites",
      colorAttachments: [
        {
          view: target,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.group);
    pass.draw(6, 768);
    pass.end();
  }
  destroy() {
    this.buffer.destroy();
    this.group = undefined;
  }
}
