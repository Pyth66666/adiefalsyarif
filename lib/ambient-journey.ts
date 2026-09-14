export const atmosphereStops = [
  { selector:"#build", color:[35,85,81] },
  { selector:"#projects", color:[37,62,96] },
  { selector:"#hackdev", color:[54,49,83] },
  { selector:"#create", color:[100,64,50] },
  { selector:"#collection", color:[59,59,88] },
  // One unbroken palette from the signal arcade through the final footer.
  { selector:"#lab", color:[40,65,81] },
] as const;

export function atmosphereAt(position:number,anchors:number[]) {
  if(!anchors.length)return [40,65,81];
  let index=0;
  while(index<anchors.length-1 && position>=anchors[index+1])index++;
  const next=Math.min(index+1,anchors.length-1);
  const distance=anchors[next]-anchors[index];
  const t=distance>0?Math.max(0,Math.min(1,(position-anchors[index])/distance)):0;
  const smooth=t*t*(3-2*t);
  return atmosphereStops[index].color.map((value,c)=>Math.round(value+(atmosphereStops[next].color[c]-value)*smooth));
}
