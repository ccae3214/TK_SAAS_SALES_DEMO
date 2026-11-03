'use client';

import { useEffect, useState } from 'react';

export function splitPersonName(value='') {
  const text=String(value||'').trim();
  if(text.includes('/')){
    const [surname='',givenName='',middleName='']=text.split('/').map(part=>part.trim());
    return {surname,givenName,middleName};
  }
  const words=text.split(/\s+/).filter(Boolean);
  if(words.length<2)return {surname:'',givenName:words[0]||'',middleName:''};
  return {surname:words.at(-1),givenName:words[0],middleName:words.slice(1,-1).join(' ')};
}

export function joinPersonName(parts) {
  return [parts.surname,parts.givenName,parts.middleName].map(part=>String(part||'').trim()).filter(Boolean).join(' / ');
}

export default function PersonNameFields({name,value='',label='',required=false,className='',onChange}) {
  const [parts,setParts]=useState(()=>splitPersonName(value));
  useEffect(()=>setParts(splitPersonName(value)),[value]);
  const fields=[['surname','姓氏'],['givenName','名字'],['middleName','中間名']];
  function updatePart(key,nextValue){const updated={...parts,[key]:nextValue};setParts(updated);onChange?.(joinPersonName(updated));}
  return <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'8px 12px',gridColumn:'1/-1',minWidth:0}}>
    {label&&<strong style={{gridColumn:'1/-1'}}>{label}</strong>}
    {fields.map(([key,fieldLabel])=><label className={className} key={key}>{fieldLabel}<input type="text" value={parts[key]} required={required&&key!=='middleName'} maxLength={120} onChange={event=>updatePart(key,event.target.value)}/></label>)}
    <input type="hidden" name={name} value={joinPersonName(parts)}/>
  </div>;
}
