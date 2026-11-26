export const staffTones=[
 ['#e2efe7','#244b38','#b1d2be'],
 ['#f6e5de','#6a4133','#dfb8a9'],
 ['#e1ecf8','#2b4d69','#b2cce5'],
 ['#eee6f5','#554265','#ceb9df'],
 ['#f6edd4','#614c23','#dbc78a'],
 ['#e0efee','#285455','#a9cfcc'],
 ['#f3e4ec','#64364d','#dfb4c8'],
 ['#e6ebdb','#414e30','#b9c79d'],
 ['#ece8df','#52463b','#c9bda9'],
 ['#e9e7f6','#49456d','#c0b9e3'],
 ['#dfece4','#305650','#aad0c5'],
 ['#f4e7dc','#66432b','#dcbc9e'],
];
export function staffColor(name,roster){
 if(!name)return null;
 const index=roster.indexOf(name);
 if(index<0)return null;
 if(index<staffTones.length)return staffTones[index];
 const hue=Math.round(((index-staffTones.length)*137.508+18)%360);
 return [`hsl(${hue} 35% 91%)`,`hsl(${hue} 33% 25%)`,`hsl(${hue} 29% 74%)`];
}
export function colorStaff(node,name,roster){
 const color=staffColor(name,roster);
 node.classList.toggle('staff-colored',!!color);
 if(color)for(const [i,prop] of ['--staff-bg','--staff-fg','--staff-border'].entries())node.style.setProperty(prop,color[i]);
}
