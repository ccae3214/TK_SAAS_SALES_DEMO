'use client';

import { useEffect, useState } from 'react';
import { splitPersonName, joinPersonName } from '@/lib/person-name';

export { splitPersonName, joinPersonName };

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
