export const planetStops = [
  { selector:"#build > section:first-child", kind:0, side:.88, size:.48 },
  { selector:"#telemetry", kind:5, side:.12, size:.3 },
  { selector:"#projects", kind:2, side:.88, size:.4 },
  { selector:"#cybermap", kind:4, side:.12, size:.34 },
  { selector:"#hackdev", kind:1, side:.88, size:.34 },
  { selector:"#timeline", kind:3, side:.85, size:.38 },
  { selector:"#create > section:first-child", kind:1, side:.14, size:.44 },
  { selector:"#gallery", kind:5, side:.88, size:.3 },
  { selector:"#collection", kind:2, side:.88, size:.45 },
  { selector:"#lab", kind:3, side:.16, size:.34 },
  { selector:"#about", kind:4, side:.88, size:.34 },
  { selector:"#contact", kind:0, side:.14, size:.4 },
] as const;

export function planetFrame(top:number,bottom:number,viewport:number,reduced=false) {
  const center=viewport*.5;
  if(top>center || bottom<=center)return null;
  const progress=Math.max(0,Math.min(1,(center-top)/Math.max(1,bottom-top)));
  const fade=Math.min(1,(center-top)/(viewport*.28),(bottom-center)/(viewport*.28));
  return { opacity:reduced?.52:fade*.62, y:reduced?.5:.72-progress*.44, scale:reduced?1:.9+progress*.18 };
}
