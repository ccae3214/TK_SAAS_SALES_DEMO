"use client";

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useLanguage } from '@/context/LanguageContext';
import { HrLanguageTools, translateHrText } from '@/lib/hr-translations';
import HrChat from '@/components/HrChat';
import HrReminders from '@/components/HrReminders';
import PersonNameFields from '@/components/PersonNameFields';

const labels = { worker: '工人', employer: '雇主', agency: '仲介' };
const EMPTY_WORKER_RESUME = {
  photoDataUrl:'',referenceNo:'',birthDate:'',gender:'',birthplace:'',address:'',height:'',weight:'',skinComplexion:'',maritalStatus:'',religion:'',hobby:'',
  spouseName:'',spouseOccupation:'',spouseAge:'',numberOfChildren:'',childrenAges:'',fatherName:'',fatherOccupation:'',fatherBirthDate:'',motherName:'',motherOccupation:'',motherBirthDate:'',brotherCount:'',brotherAges:'',sisterCount:'',sisterAges:'',familyRank:'',caregiverDuringOverseas:'',
  educationLevels:'',education:'',coursesCompleted:'',languageOptions:'',languages:'',cookingSkills:'',applianceOptions:'',applianceSkills:'',childcareSkills:'',experienceNewborn:'',experienceChildren:'',experienceElderly:'',experienceDisabled:'',
  hasTattoo:'',smokes:'',drinksAlcohol:'',petExperience:'',willingToWorkWithPets:'',seriousIllness:'',operationLast12Months:'',allergies:'',dayOffChores:'',finishChoresBeforeOuting:'',returnBy8PM:'',makeupAtWork:'',workOnDaysOff:'',workedAbroad:'',overseasWorkDetails:'',employmentHistory:'',overseasExperiences:[],employmentExperiences:[],remarks:'',
};
const WORKER_RESUME_GROUPS = [
  { title:'基本資料', fields:[['referenceNo','履歷編號'],['birthDate','出生日期'],['gender','性別'],['birthplace','出生地'],['address','地址'],['height','身高（cm）'],['weight','體重（kg）'],['skinComplexion','膚色'],['maritalStatus','婚姻狀況'],['religion','宗教'],['hobby','興趣']] },
  { title:'家庭資料', fields:[['spouseName','配偶姓名'],['spouseOccupation','配偶職業'],['spouseAge','配偶年齡'],['numberOfChildren','子女人數'],['childrenAges','子女年齡'],['fatherName','父親姓名'],['fatherOccupation','父親職業'],['fatherBirthDate','父親出生日期'],['motherName','母親姓名'],['motherOccupation','母親職業'],['motherBirthDate','母親出生日期'],['brotherCount','兄弟人數'],['brotherAges','兄弟年齡'],['sisterCount','姊妹人數'],['sisterAges','姊妹年齡'],['familyRank','家中排行'],['caregiverDuringOverseas','出國工作期間子女照顧者']] },
  { title:'教育與語言', fields:[['educationLevels','教育程度'],['education','教育背景'],['coursesCompleted','完成課程'],['languages','語言能力']] },
  { title:'技能與照護經驗', fields:[['cookingSkills','烹飪技能'],['applianceOptions','家電操作'],['childcareSkills','嬰幼兒照護技能'],['experienceNewborn','新生兒照護經驗'],['experienceChildren','兒童照護經驗'],['experienceElderly','長者照護經驗'],['experienceDisabled','身心障礙者照護經驗']] },
  { title:'個人資料問答', fields:[['hasTattoo','是否有刺青'],['smokes','是否吸菸'],['drinksAlcohol','是否飲酒'],['petExperience','寵物照護經驗與種類'],['willingToWorkWithPets','是否願意在有寵物的家庭工作'],['seriousIllness','是否曾有重大疾病'],['operationLast12Months','過去 12 個月是否接受手術'],['allergies','是否有過敏'],['dayOffChores','休假日是否願意完成家務'],['finishChoresBeforeOuting','外出前是否完成家務'],['returnBy8PM','休假日是否可於晚上 8 點前返家'],['makeupAtWork','工作時是否化妝'],['workOnDaysOff','是否願意於休假日加班'],['workedAbroad','是否曾在海外工作']] },
  { title:'海外工作經歷', fields:[['overseasExperiences','海外工作地點與期間']] },
  { title:'國內工作經歷', fields:[['employmentExperiences','工作經歷']] },
  { title:'備註', fields:[['remarks','其他說明']] },
];
const WORKER_RESUME_TEXTAREAS = new Set(['address','education','coursesCompleted','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','petExperience','overseasWorkDetails','employmentHistory','remarks']);
const WORKER_RESUME_YES_NO = new Set(['hasTattoo','smokes','drinksAlcohol','willingToWorkWithPets','seriousIllness','operationLast12Months','allergies','dayOffChores','finishChoresBeforeOuting','returnBy8PM','makeupAtWork','workOnDaysOff','workedAbroad']);
const WORKER_RESUME_CHOICES = {
  cookingSkills:['台灣','廣東','中國','日本','泰國','印度','韓國','菲律賓'],
  applianceOptions:['Washing Machine','Oven','Vacuum Cleaner','Microwave Oven','Dish Washer','Others'],
  childcareSkills:['Bathing','Changing diapers','Sterilizing utensils','Feeding','Taking temperature','Others'],
};
const WORKER_RESUME_LANGUAGES = ['English','Tagalog','Cantonese','Mandarin','Others'];
const WORKER_RESUME_SELECTS = {
  height:['145以下',...Array.from({length:36},(_,index)=>String(index+145)),'181以上'],
  weight:['39以下',...Array.from({length:31},(_,index)=>String(index+40)),'71以上'],
  maritalStatus:['單身','有伴侶','已結婚'],
  numberOfChildren:Array.from({length:11},(_,index)=>String(index)),
  brotherCount:Array.from({length:11},(_,index)=>String(index)),
  sisterCount:Array.from({length:11},(_,index)=>String(index)),
  educationLevels:['小學','國中','高中','專科','大學'],
};
function resumeChoiceList(value) { return String(value||'').split(/[,，、;；|]/).map(item=>item.trim()).filter(Boolean); }
function readLanguageLevels(value,selected) {
  try{const parsed=JSON.parse(value||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return Object.fromEntries(selected.map(language=>[language,['basic','medium','native'].includes(parsed[language])?parsed[language]:'basic']));}catch{}
  return Object.fromEntries(selected.map(language=>[language,'basic']));
}
function formatLanguageLevels(languageOptions,value) {
  const selected=resumeChoiceList(languageOptions);if(!selected.length)return String(value||'');
  const levels=readLanguageLevels(value,selected),labels={basic:'基礎',medium:'中等',native:'本地'};
  return selected.map(language=>`${translateHrText(language,'en')} (${translateHrText(labels[levels[language]]||labels.basic,'en')})`).join('; ');
}
function LanguageSkillsEditor({label,workerForm,updateWorkerResume}) {
  const options=WORKER_RESUME_LANGUAGES,selected=resumeChoiceList(workerForm.resumeProfile.languageOptions),levels=readLanguageLevels(workerForm.resumeProfile.languages,selected);
  function updateSelected(next){const nextLevels=readLanguageLevels(workerForm.resumeProfile.languages,next);for(const language of next)if(!nextLevels[language])nextLevels[language]='basic';updateWorkerResume('languageOptions',next.join('、'));updateWorkerResume('languages',JSON.stringify(nextLevels));}
  function updateLevel(language,level){updateWorkerResume('languages',JSON.stringify({...levels,[language]:level}));}
  return <fieldset className="resume-choice-field resume-language-field"><legend>{label}</legend><div className="resume-choice-list">{options.map(language=><label className="resume-choice-item" key={language}><input type="checkbox" checked={selected.includes(language)} onChange={event=>updateSelected(event.target.checked?[...selected,language]:selected.filter(value=>value!==language))}/><span>{language}</span></label>)}</div>{selected.map(language=><label className="resume-language-level" key={language}><span>{language}</span><select value={levels[language]||'basic'} onChange={event=>updateLevel(language,event.target.value)}><option value="basic">基礎</option><option value="medium">中等</option><option value="native">本地</option></select></label>)}</fieldset>;
}
function normalizeExperienceRows(profile,field,legacyField) {
  const rows=profile?.[field];
  if(Array.isArray(rows)&&rows.length)return rows.filter(row=>row&&typeof row==='object').map(row=>({workplace:String(row.workplace||''),period:String(row.period||''),title:String(row.title||''),content:String(row.content||'')}));
  const legacy=String(profile?.[legacyField]||'').trim();
  return legacy?legacy.split(/\r?\n/).map(content=>content.trim()).filter(Boolean).map(content=>({workplace:'',period:'',title:'',content})):[];
}
function experienceRowsText(profile,field,legacyField) {
  return normalizeExperienceRows(profile,field,legacyField).filter(row=>row.workplace||row.period||row.title||row.content).map((row,index)=>[
    `${index+1}. ${row.workplace}`,
    row.period?`Period: ${row.period}`:'',
    row.title?`Position: ${row.title}`:'',
    row.content?`Details: ${row.content}`:'',
  ].filter(Boolean).join('\n')).join('\n\n');
}
function resumeFieldText(profile,field) {
  if(field==='overseasExperiences')return experienceRowsText(profile,field,'overseasWorkDetails');
  if(field==='employmentExperiences')return experienceRowsText(profile,field,'employmentHistory');
  return String(profile?.[field]||'').trim();
}
function ExperienceListEditor({field,label,workerForm,updateWorkerResume,overseas=false}) {
  const legacyField=overseas?'overseasWorkDetails':'employmentHistory';
  const rows=normalizeExperienceRows(workerForm.resumeProfile,field,legacyField);
  const change=(index,key,value)=>{const next=[...rows];next[index]={...next[index],[key]:value};updateWorkerResume(field,next);};
  return <section className="resume-experience-editor resume-field-wide"><h4>{label}</h4>{rows.map((row,index)=><fieldset className="resume-experience-row" key={`${field}-${index}`}><legend>{overseas?`海外工作 ${index+1}`:`國內工作 ${index+1}`}</legend><label>{overseas?'工作地點／雇主':'工作／雇主'}<input value={row.workplace} onChange={event=>change(index,'workplace',event.target.value)}/></label><label>工作期間<input placeholder="例如：2020–2023" value={row.period} onChange={event=>change(index,'period',event.target.value)}/></label><label>職稱<input value={row.title} onChange={event=>change(index,'title',event.target.value)}/></label><label className="resume-field-wide">工作內容<textarea rows="3" value={row.content} onChange={event=>change(index,'content',event.target.value)}/></label><button type="button" className="resume-experience-remove" onClick={()=>updateWorkerResume(field,rows.filter((_,rowIndex)=>rowIndex!==index))}>刪除此經歷</button></fieldset>)}<button type="button" className="resume-experience-add" onClick={()=>updateWorkerResume(field,[...rows,{workplace:'',period:'',title:'',content:''}])}>＋新增工作經驗</button></section>;
}
const RESUME_IMPORT_LABELS = [
  ['referenceNo',['resume reference number','reference no','resume no','履歷編號']],['birthDate',['date of birth','birth date','出生日期']],['gender',['sex','gender','性別']],['birthplace',['place of birth','birthplace','出生地']],['address',['address','present address','地址']],['height',['height','身高']],['weight',['weight','體重']],['skinComplexion',['complexion','膚色']],['maritalStatus',['marital status','婚姻狀況']],['religion',['religion','宗教']],['hobby',['hobbies','hobby','興趣']],
  ['spouseName',['spouse name','husband/wife','配偶姓名']],['spouseOccupation',['spouse occupation','配偶職業']],['spouseAge',['spouse age','配偶年齡']],['numberOfChildren',['number of children','no. of children','子女人數']],['childrenAges',['children ages','ages of children','子女年齡']],['fatherName',['father name','父親姓名']],['fatherOccupation',['father occupation','父親職業']],['fatherBirthDate',['father date of birth','father birth date','父親出生日期']],['motherName',['mother name','母親姓名']],['motherOccupation',['mother occupation','母親職業']],['motherBirthDate',['mother date of birth','mother birth date','母親出生日期']],['brotherCount',['number of brothers','兄弟人數']],['brotherAges',['brothers ages','兄弟年齡']],['sisterCount',['number of sisters','姊妹人數']],['sisterAges',['sisters ages','姊妹年齡']],['familyRank',['birth order','家中排行']],['caregiverDuringOverseas',['child caregiver while abroad','出國工作期間子女照顧者']],['education',['education','educational attainment','教育背景']],['coursesCompleted',['course completed','courses completed','courses attended','training completed','完成課程']],['languages',['language','languages','language proficiency','語言能力']],['cookingSkills',['cooking skills','烹飪技能']],['applianceSkills',['home electrical appliance operation','appliances operated','home appliances','家電操作']],['childcareSkills',['childcare skills','嬰幼兒照護技能']],['experienceNewborn',['newborn experience','newborn care experience','新生兒照護經驗']],['experienceChildren',['childcare experience','children care experience','兒童照護經驗']],['experienceElderly',['elderly care experience','elder care experience','長者照護經驗']],['experienceDisabled',['disabled care experience','身心障礙者照護經驗']],['hasTattoo',['tattoo','do you have a tattoo','是否有刺青']],['smokes',['smoking','do you smoke','是否吸菸']],['drinksAlcohol',['drinking alcohol','do you drink alcohol','是否飲酒']],['petExperience',['pet care experience','pets experience','寵物照護經驗與種類']],['willingToWorkWithPets',['willing to work with pets','是否願意在有寵物的家庭工作']],['seriousIllness',['serious illness','是否曾有重大疾病']],['operationLast12Months',['operation in the last 12 months','surgery in the last 12 months','過去 12 個月是否接受手術']],['allergies',['allergies','do you have allergies','是否有過敏']],['dayOffChores',['chores on day off','休假日是否願意完成家務']],['finishChoresBeforeOuting',['finish chores before going out','外出前是否完成家務']],['returnBy8PM',['return home by 8 pm','休假日是否可於晚上 8 點前返家']],['makeupAtWork',['makeup at work','工作時是否化妝']],['workOnDaysOff',['work on days off','休假日是否願意加班']],['workedAbroad',['worked abroad','是否曾在海外工作']],['employmentHistory',['employment history','work experience','工作經歷']],['overseasWorkDetails',['overseas work details','overseas employment','海外工作地點與期間']],['remarks',['remarks','additional information','其他說明']],
];
function ResumeFieldEditor({ field,label,workerForm,updateWorkerResume }) {
  if(field==='overseasExperiences'||field==='employmentExperiences')return <ExperienceListEditor field={field} label={label} workerForm={workerForm} updateWorkerResume={updateWorkerResume} overseas={field==='overseasExperiences'}/>;
  if(field==='languages')return <LanguageSkillsEditor label={label} workerForm={workerForm} updateWorkerResume={updateWorkerResume}/>;
  if(['spouseName','fatherName','motherName'].includes(field))return <PersonNameFields name={field} label={label} value={workerForm.resumeProfile[field]||''} onChange={value=>updateWorkerResume(field,value)}/>;
  if(field==='religion'){
    const value=workerForm.resumeProfile.religion||'',known=value==='天主教'||/catholic/i.test(value)?'天主教':value==='基督教'||/christian/i.test(value)?'基督教':'',other=value.startsWith('其他：')?value.slice(3):value==='其他'?'':value,selected=known|| (value?'其他':'');
    return <div className="resume-religion-field"><label>{label}<select value={selected} onChange={event=>updateWorkerResume(field,event.target.value==='其他'?'其他':event.target.value)}><option value="">請選擇</option><option value="天主教">天主教</option><option value="基督教">基督教</option><option value="其他">其他</option></select></label>{selected==='其他'&&<label>請填寫其他宗教<input required value={other} onChange={event=>updateWorkerResume(field,`其他：${event.target.value}`)}/></label>}</div>;
  }
  const choices=WORKER_RESUME_CHOICES[field];
  if(choices){const selected=resumeChoiceList(workerForm.resumeProfile[field]);return <fieldset className="resume-choice-field"><legend>{label}</legend><div className="resume-choice-list">{choices.map(choice=><label className="resume-choice-item" key={choice}><input type="checkbox" checked={selected.includes(choice)} onChange={event=>updateWorkerResume(field,event.target.checked?[...selected,choice].join('、'):selected.filter(value=>value!==choice).join('、'))}/><span>{choice}</span></label>)}</div></fieldset>;}
  if(field==='gender')return <label>{label}<select required value={workerForm.resumeProfile.gender||''} onChange={event=>updateWorkerResume(field,event.target.value)}><option value="">請選擇</option><option value="male">Male</option><option value="female">Female</option></select></label>;
  if(field==='referenceNo')return <label>{label}<input value={workerForm.resumeProfile.referenceNo||''} maxLength={80} placeholder="依工作類型與性別自動編號" onChange={event=>updateWorkerResume(field,event.target.value)}/></label>;
  if(WORKER_RESUME_SELECTS[field]){const value=workerForm.resumeProfile[field]||'';return <label>{label}<select value={value} onChange={event=>updateWorkerResume(field,event.target.value)}><option value="">請選擇</option>{value&&field!=='educationLevels'&&!WORKER_RESUME_SELECTS[field].includes(value)&&<option value={value}>{value}</option>}{WORKER_RESUME_SELECTS[field].map(choice=><option key={choice} value={choice}>{choice}</option>)}</select></label>;}
  if(field==='skinComplexion')return <label>{label}<select value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}><option value="">請選擇</option>{['白','黃','黑'].map(choice=><option key={choice} value={choice}>{choice}</option>)}</select></label>;
  if(WORKER_RESUME_YES_NO.has(field)){const value=workerForm.resumeProfile[field]||'';return <fieldset className="resume-radio-field"><legend>{label}</legend><div><label><input type="radio" name={`resume-${field}`} value="是" checked={value==='是'} onChange={event=>updateWorkerResume(field,event.target.value)}/><span>是</span></label><label><input type="radio" name={`resume-${field}`} value="否" checked={value==='否'} onChange={event=>updateWorkerResume(field,event.target.value)}/><span>否</span></label></div></fieldset>;}
  if(['childrenAges','brotherAges','sisterAges'].includes(field))return <label>{label}<input type="text" placeholder="18,5,2,1" value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}/><small>請用逗號分隔，並由大到小排列。例如：18,5,2,1</small></label>;
  return <label className={WORKER_RESUME_TEXTAREAS.has(field)?'resume-field-wide':''}>{label}{WORKER_RESUME_TEXTAREAS.has(field)?<textarea placeholder={field==='employmentHistory'?'每段經歷請填：雇主｜職務｜地址／電話｜期間｜服務人數／年齡｜離職原因｜工作內容':''} rows={field==='employmentHistory'?6:3} value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}/>:<input type={['birthDate','fatherBirthDate','motherBirthDate'].includes(field)?'date':'text'} value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}/>}</label>;
}
function extractResumeFields(text) {
  const fields={};
  for(const rawLine of text.split(/\r?\n/)){
    const line=normalizeResumeLine(rawLine);if(!line)continue;
    for(const [field,aliases] of RESUME_IMPORT_LABELS){
      const escaped=aliases.map(alias=>alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
      const match=line.match(new RegExp(`(?:^|\\s)(?:${escaped})(?:\\s*[:：\\-]\\s*|\\s+)(.+)$`,'i'));
      if(match&&match[1].trim()&&match[1].trim().length<2000&&!fields[field])fields[field]=stripRepeatedResumeLabel(trimAtNextResumeLabel(match[1]),aliases);
    }
  }
  return fields;
}
async function extractEmbeddedResumePortrait(pdfjs,page) {
  const operations=await page.getOperatorList(),imageOps=new Set([pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageXObjectRepeat]);
  const candidates=[];
  for(let index=0;index<operations.fnArray.length;index++){
    if(!imageOps.has(operations.fnArray[index]))continue;
    const firstArg=operations.argsArray[index]?.[0];let image=firstArg;
    if(typeof firstArg==='string')image=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),900);page.objs.get(firstArg,value=>{clearTimeout(timer);resolve(value);});});
    if(!image?.data||!image.width||!image.height)continue;
    const aspect=image.width/image.height,area=image.width*image.height;
    if(image.width<160||image.height<200||aspect<0.42||aspect>1.15)continue;
    let displayMatrix=null;for(let previous=index-1;previous>=0;previous--){if(operations.fnArray[previous]===pdfjs.OPS.transform){displayMatrix=operations.argsArray[previous];break;}if(operations.fnArray[previous]===pdfjs.OPS.restore)break;}
    if(displayMatrix){const pageWidth=page.view[2]-page.view[0],pageHeight=page.view[3]-page.view[1],displayWidth=Math.hypot(displayMatrix[0],displayMatrix[1]),displayHeight=Math.hypot(displayMatrix[2],displayMatrix[3]);if(displayWidth>pageWidth*0.72&&displayHeight>pageHeight*0.72)continue;}
    candidates.push({image,score:area*(aspect<0.58?0.85:1)});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const image=candidates[0]?.image;if(!image)return '';
  const width=image.width,height=image.height,pixels=image.data,source=document.createElement('canvas');source.width=width;source.height=height;
  const context=source.getContext('2d',{willReadFrequently:false});if(!context)return '';
  const rgba=context.createImageData(width,height),rgbaData=rgba.data;
  if(pixels.length===width*height*4)rgbaData.set(pixels);
  else if(pixels.length===width*height*3){for(let src=0,dst=0;src<pixels.length;src+=3,dst+=4){rgbaData[dst]=pixels[src];rgbaData[dst+1]=pixels[src+1];rgbaData[dst+2]=pixels[src+2];rgbaData[dst+3]=255;}}
  else if(pixels.length===width*height){for(let src=0,dst=0;src<pixels.length;src++,dst+=4){rgbaData[dst]=rgbaData[dst+1]=rgbaData[dst+2]=pixels[src];rgbaData[dst+3]=255;}}
  else return '';
  context.putImageData(rgba,0,0);
  const output=document.createElement('canvas'),scale=Math.min(600/width,800/height,1);output.width=Math.max(1,Math.round(width*scale));output.height=Math.max(1,Math.round(height*scale));
  const outputContext=output.getContext('2d');if(!outputContext)return '';outputContext.fillStyle='#fff';outputContext.fillRect(0,0,output.width,output.height);outputContext.drawImage(source,0,0,output.width,output.height);
  return output.toDataURL('image/jpeg',0.86);
}
async function extractRenderedResumePortrait(pdfjs,page) {
  const viewport=page.getViewport({scale:1}),renderScale=Math.min(1.6,1500/Math.max(viewport.width,viewport.height)),renderViewport=page.getViewport({scale:renderScale});
  const pageCanvas=document.createElement('canvas');pageCanvas.width=Math.max(1,Math.ceil(renderViewport.width));pageCanvas.height=Math.max(1,Math.ceil(renderViewport.height));
  const pageContext=pageCanvas.getContext('2d');if(!pageContext)return '';
  await page.render({canvasContext:pageContext,viewport:renderViewport}).promise;
  const operations=await page.getOperatorList(),imageOps=new Set([pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageXObjectRepeat]);
  const stack=[];let matrix=[1,0,0,1,0,0];const candidates=[];
  const multiply=(left,right)=>[left[0]*right[0]+left[2]*right[1],left[1]*right[0]+left[3]*right[1],left[0]*right[2]+left[2]*right[3],left[1]*right[2]+left[3]*right[3],left[0]*right[4]+left[2]*right[5]+left[4],left[1]*right[4]+left[3]*right[5]+left[5]];
  for(let index=0;index<operations.fnArray.length;index++){
    const operation=operations.fnArray[index],args=operations.argsArray[index]||[];
    if(operation===pdfjs.OPS.save){stack.push(matrix);continue;}
    if(operation===pdfjs.OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
    if(operation===pdfjs.OPS.transform){matrix=multiply(matrix,args);continue;}
    if(!imageOps.has(operation))continue;
    const [a,b,c,d,e,f]=matrix,width=Math.hypot(a,b),height=Math.hypot(c,d),aspect=width/Math.max(height,1),area=width*height/(viewport.width*viewport.height);
    if(!Number.isFinite(area)||area<0.012||area>0.38||aspect<0.38||aspect>1.15)continue;
    const points=[[e,f],[e+a,f+b],[e+c,f+d],[e+a+c,f+b+d]].map(([x,y])=>renderViewport.convertToViewportPoint(x,y));
    const left=Math.max(0,Math.floor(Math.min(...points.map(point=>point[0])))),right=Math.min(pageCanvas.width,Math.ceil(Math.max(...points.map(point=>point[0]))));
    const top=Math.max(0,Math.floor(Math.min(...points.map(point=>point[1])))),bottom=Math.min(pageCanvas.height,Math.ceil(Math.max(...points.map(point=>point[1]))));
    if(right-left<40||bottom-top<55)continue;
    const positionBonus=top<pageCanvas.height*0.55?1.15:1;
    candidates.push({left,top,width:right-left,height:bottom-top,score:area*positionBonus*(aspect<0.85?1.15:1)});
  }
  candidates.sort((a,b)=>b.score-a.score);const candidate=candidates[0];if(!candidate)return '';
  const output=document.createElement('canvas'),scale=Math.min(600/candidate.width,800/candidate.height,1);output.width=Math.max(1,Math.round(candidate.width*scale));output.height=Math.max(1,Math.round(candidate.height*scale));
  const context=output.getContext('2d');if(!context)return '';context.fillStyle='#fff';context.fillRect(0,0,output.width,output.height);context.drawImage(pageCanvas,candidate.left,candidate.top,candidate.width,candidate.height,0,0,output.width,output.height);
  return output.toDataURL('image/jpeg',0.88);
}
function captureResumeSection(text, startPattern, endPattern) {
  const lines=String(text||'').split(/\r?\n/).map(normalizeResumeLine),start=lines.findIndex(line=>startPattern.test(line));
  if(start<0)return '';
  const selected=[];
  for(let index=start;index<lines.length;index++){if(index>start&&endPattern.test(lines[index]))break;if(lines[index])selected.push(lines[index]);}
  return selected.join('\n').slice(0,5000);
}
function stripRepeatedResumeLabel(value, aliases) {
  let result=normalizeResumeLine(value);
  const escaped=[...aliases].sort((a,b)=>b.length-a.length).map(alias=>alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const repeatedLabel=new RegExp(`^(?:${escaped})(?:\\s*[:：\\-]\\s*|\\s+)(?=\\S)`,'i');
  for(let count=0;count<8&&repeatedLabel.test(result);count++)result=result.replace(repeatedLabel,'').trim();
  return result;
}
function stripRepeatedPatternLabel(value, labels) {
  let result=normalizeResumeLine(value);
  const repeatedLabel=new RegExp(`^(?:${labels.join('|')})(?:\\s*[:：\\-]\\s*|\\s+)(?=\\S)`,'i');
  for(let count=0;count<8&&repeatedLabel.test(result);count++)result=result.replace(repeatedLabel,'').trim();
  return result;
}
function normalizeResumeLine(value) {
  return String(value||'').replace(/\s+/g,' ').replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g,'$1$2').trim();
}
function trimAtNextResumeLabel(value) {
  const text=normalizeResumeLine(value);
  const patterns=[
    /\b(?:CONTACT\s*(?:NO\.?|NUMBER)|PHONE(?:\s*NO\.?)?|MOBILE(?:\s*NO\.?)?|TELEPHONE(?:\s*NO\.?)?|E-?MAIL|NATIONALITY|DATE\s+OF\s+BIRTH|BIRTH\s+DATE|GENDER|SEX|RELIGION|ADDRESS|HEIGHT|WEIGHT|MARITAL\s+STATUS|EDUCATION|LANGUAGES?|HOBBIES?|POSITION\s+APPLIED|JOB\s+PREFERENCE)(?=\s|[:：]|$)/ig,
    /(?:姓名|聯絡電話|联系电\s*话|電話|电话|國籍|国籍|出生日期|性別|性别|宗教|地址|身高|體重|体重|婚姻狀況|婚姻状况|教育背景|語言能力|语言能力)\s*[:：]/g,
  ];
  let end=text.length;
  for(const pattern of patterns){pattern.lastIndex=0;let match;while((match=pattern.exec(text))){if(match.index>0){end=Math.min(end,match.index);break;}if(match[0].length===0)pattern.lastIndex++;}}
  return text.slice(0,end).replace(/[\s:：,;|–—-]+$/,'').trim();
}
function WorkerResumeSections({ profile }) {
  const resume = profile && typeof profile === 'object' ? profile : {};
  const groups = WORKER_RESUME_GROUPS.map(group=>({...group,fields:group.fields.filter(([field])=>resumeFieldText(resume,field))})).filter(group=>group.fields.length);
  if (!groups.length) return <p className="resume-empty">尚未填寫履歷資料。</p>;
  return <div className="worker-resume-sections">{groups.map(group=><section className="worker-resume-section" key={group.title}><h3>{group.title}</h3><dl className="resume-fields">{group.fields.map(([field,label])=><div className={['education','languages','hobby','address','cookingSkills','applianceOptions','childcareSkills','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','employmentExperiences','overseasExperiences'].includes(field)?'resume-value-wide':''} key={field}><dt>{label}</dt><dd>{field==='languages'?formatLanguageLevels(resume.languageOptions,resume.languages):field==='overseasExperiences'||field==='employmentExperiences'?normalizeExperienceRows(resume,field,field==='overseasExperiences'?'overseasWorkDetails':'employmentHistory').filter(row=>row.workplace||row.period||row.title||row.content).map((row,index)=><div className="resume-experience-view" key={`${field}-view-${index}`}><strong>{index+1}. {row.workplace}</strong>{row.period&&<span>{row.period}</span>}{row.title&&<span>{row.title}</span>}{row.content&&<p>{row.content}</p>}</div>):resume[field]}</dd></div>)}</dl></section>)}</div>;
}
const RESUME_LONG_FIELDS = new Set(['address','education','coursesCompleted','languages','cookingSkills','applianceSkills','childcareSkills','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','petExperience','overseasWorkDetails','employmentHistory','overseasExperiences','employmentExperiences','remarks','caregiverDuringOverseas','childrenAges','brotherAges','sisterAges']);
async function createWorkerResumePdf(worker) {
  const profile=worker.resume_profile&&typeof worker.resume_profile==='object'?worker.resume_profile:{};
  const logicalWidth=794,logicalHeight=1123,scale=1.5,pages=[];
  let resumePhoto=null;
  if(profile.photoDataUrl&&/^data:image\/(png|jpeg);base64,/.test(profile.photoDataUrl)){try{resumePhoto=new Image();resumePhoto.src=profile.photoDataUrl;await new Promise((resolve,reject)=>{resumePhoto.onload=resolve;resumePhoto.onerror=reject});}catch{resumePhoto=null;}}
  let canvas,ctx,y;
  const ink='#23352e',muted='#66776e',green='#176b54',line='#dce6e1';
  const newPage=(first=false)=>{
    canvas=document.createElement('canvas');canvas.width=logicalWidth*scale;canvas.height=logicalHeight*scale;ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,logicalWidth,logicalHeight);
    ctx.fillStyle=green;ctx.fillRect(0,0,logicalWidth,10);
    if(first){ctx.fillStyle=green;ctx.font='700 13px Arial, sans-serif';ctx.fillText('KOLECION EMPLOYMENT AGENCY',48,48);ctx.fillStyle=ink;ctx.font='700 32px Arial, "Noto Sans TC", sans-serif';ctx.fillText('WORKER RESUME',48,91);ctx.font='400 15px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=muted;ctx.fillText('工人履歷',48,119);ctx.font='700 25px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;ctx.fillText(String(worker.name||'Worker'),48,166);const summary=[worker.nationality,translateHrText(worker.job_preference||'','en')].filter(Boolean).join(' · ');ctx.font='400 14px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=muted;ctx.fillText(summary,48,192);y=232;
      if(resumePhoto){ctx.drawImage(resumePhoto,logicalWidth-145,42,96,124);}
    }else{ctx.fillStyle=ink;ctx.font='700 16px Arial, "Noto Sans TC", sans-serif';ctx.fillText(String(worker.name||'Worker'),48,48);ctx.font='400 11px Arial, sans-serif';ctx.fillStyle=muted;ctx.fillText('WORKER RESUME · CONTINUED',48,69);y=96;}
    pages.push(canvas);
  };
  const wrap=(text,maxWidth,font)=>{ctx.font=font;const lines=[];for(const paragraph of String(text||'').split(/\r?\n/)){if(!paragraph){lines.push('');continue;}let line='';for(const char of paragraph){const candidate=line+char;if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=char;}else line=candidate;}lines.push(line);}return lines;};
  const ensureSpace=height=>{if(y+height>logicalHeight-58)newPage(false);};
  newPage(true);
  const contact=[['Nationality',worker.nationality],['Phone',worker.phone],['Email',worker.email],['Job preference',translateHrText(worker.job_preference||'','en')]].filter(([,value])=>value);
  if(contact.length){ctx.fillStyle='#f3f8f5';ctx.fillRect(40,y-17,logicalWidth-80,Math.ceil(contact.length/2)*49+14);contact.forEach(([label,value],index)=>{const col=index%2,row=Math.floor(index/2),x=56+col*350,top=y+row*49;ctx.font='700 10px Arial, sans-serif';ctx.fillStyle=muted;ctx.fillText(label.toUpperCase(),x,top);ctx.font='400 13px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;ctx.fillText(String(value),x,top+21,320);});y+=Math.ceil(contact.length/2)*49+22;}
  for(const group of WORKER_RESUME_GROUPS){
    const fields=group.fields.filter(([key])=>resumeFieldText(profile,key));if(!fields.length)continue;
    ensureSpace(48);ctx.fillStyle=green;ctx.fillRect(44,y-15,4,25);ctx.font='700 15px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;ctx.fillText(translateHrText(group.title,'en'),58,y+3);ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(58,y+12);ctx.lineTo(logicalWidth-48,y+12);ctx.stroke();y+=34;
    let column=0,rowHeight=0;
    for(const [key,label] of fields){const value=key==='languages'?formatLanguageLevels(profile.languageOptions,profile.languages):resumeFieldText(profile,key);const wide=RESUME_LONG_FIELDS.has(key);if(wide&&column){y+=rowHeight+12;column=0;rowHeight=0;}if(wide){const lines=wrap(value,logicalWidth-112,'400 12px Arial, "Noto Sans TC", sans-serif');ensureSpace(38);ctx.font='700 10px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=muted;ctx.fillText(translateHrText(label,'en').toUpperCase(),58,y);y+=19;ctx.font='400 12px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;for(const text of lines){ensureSpace(19);ctx.fillText(text,58,y);y+=17;}y+=8;continue;}
      const colWidth=(logicalWidth-120)/2,x=58+column*(colWidth+18);const labelText=translateHrText(label,'en');const valueText=value==='是'?'Yes':value==='否'?'No':String(value);const lines=wrap(valueText,colWidth,'400 12px Arial, "Noto Sans TC", sans-serif');const h=32+lines.length*16;ensureSpace(h+8);ctx.font='700 10px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=muted;ctx.fillText(labelText.toUpperCase(),x,y);ctx.font='400 12px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;lines.forEach((text,index)=>ctx.fillText(text,x,y+18+index*16));rowHeight=Math.max(rowHeight,h);column+=1;if(column===2){y+=rowHeight+12;column=0;rowHeight=0;}
    }
    if(column){y+=rowHeight+12;column=0;rowHeight=0;}y+=5;
  }
  if(worker.notes){ensureSpace(70);ctx.fillStyle=green;ctx.fillRect(44,y-15,4,25);ctx.font='700 15px Arial, "Noto Sans TC", sans-serif';ctx.fillStyle=ink;ctx.fillText('NOTES',58,y+3);y+=28;const lines=wrap(worker.notes,logicalWidth-112,'400 12px Arial, "Noto Sans TC", sans-serif');lines.forEach(text=>{ensureSpace(18);ctx.fillStyle=ink;ctx.fillText(text,58,y);y+=17;});}
  pages.forEach((page,index)=>{const pctx=page.getContext('2d');pctx.save();pctx.scale(scale,scale);pctx.strokeStyle=line;pctx.beginPath();pctx.moveTo(44,logicalHeight-42);pctx.lineTo(logicalWidth-44,logicalHeight-42);pctx.stroke();pctx.font='400 10px Arial, sans-serif';pctx.fillStyle=muted;pctx.fillText('KOLECION · CONFIDENTIAL WORKER PROFILE',48,logicalHeight-23);pctx.textAlign='right';pctx.fillText(`PAGE ${index+1} / ${pages.length}`,logicalWidth-48,logicalHeight-23);pctx.restore();});
  const encoder=new TextEncoder(),objects=[],offsets=[0];let length=0;
  const push=bytes=>{objects.push(bytes);length+=bytes.length;};
  const addText=text=>encoder.encode(text);
  const concatBytes=(...parts)=>{const total=parts.reduce((sum,part)=>sum+part.length,0),result=new Uint8Array(total);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;};
  push(addText('%PDF-1.4\n%KOLECION\n'));
  const pageIds=pages.map((_,index)=>3+index*3);
  const kids=pageIds.map(id=>`${id} 0 R`).join(' ');
  const definitions=[
    [1,addText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')],
    [2,addText(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`)],
  ];
  for(let index=0;index<pages.length;index++){
    const pageId=pageIds[index],contentId=pageId+1,imageId=pageId+2,canvasPage=pages[index];
    const jpeg=Uint8Array.from(atob(canvasPage.toDataURL('image/jpeg',0.94).split(',')[1]),char=>char.charCodeAt(0));
    definitions.push([pageId,addText(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${index+1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)]);
    const content=`q\n595.28 0 0 841.89 0 0 cm\n/Im${index+1} Do\nQ\n`,contentBytes=addText(content);
    definitions.push([contentId,concatBytes(addText(`${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),contentBytes,addText('endstream\nendobj\n'))]);
    definitions.push([imageId,concatBytes(addText(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvasPage.width} /Height ${canvasPage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,addText('\nendstream\nendobj\n'))]);
  }
  definitions.sort((a,b)=>a[0]-b[0]);
  for(const [id,bytes] of definitions){offsets[id]=length;push(bytes);}
  const xrefOffset=length,maxId=definitions.at(-1)[0];let xref=`xref\n0 ${maxId+1}\n0000000000 65535 f \n`;for(let id=1;id<=maxId;id++)xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;push(addText(`${xref}trailer\n<< /Size ${maxId+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  const blob=new Blob(objects,{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`worker-resume-${worker.id||'profile'}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export default function HrMemberPortal({ actor }) {
  const { setLang } = useLanguage();
  const [activeWorkspaceTab,setActiveWorkspaceTab]=useState('basic');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [requestedRole, setRequestedRole] = useState('worker');
  const [requesting, setRequesting] = useState(false);
  const [progressWorker, setProgressWorker] = useState(null);
  const [profileWorker, setProfileWorker] = useState(null);
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [deleteWorkerError, setDeleteWorkerError] = useState('');
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerEditorOpen, setWorkerEditorOpen] = useState(false);
  const [editingEmployer, setEditingEmployer] = useState(null);
  const [workerForm, setWorkerForm] = useState({ name: '', nationality: '', phone: '', email: '', jobPreference: '', notes: '', resumeProfile:{...EMPTY_WORKER_RESUME} });
  const [employerForm, setEmployerForm] = useState({ name: '', employerType: 'home_care', contactName: '', phone: '', email: '', address: '', notes: '' });
  const [workerSaving, setWorkerSaving] = useState(false);
  const [resumePdfLoading, setResumePdfLoading] = useState(false);
  const [resumePhotoLoading, setResumePhotoLoading] = useState(false);
  const [resumeViewPhoto,setResumeViewPhoto]=useState('');
  const [resumeImporting, setResumeImporting] = useState(false);
  const [resumeImportMessage, setResumeImportMessage] = useState('');
  const [employerSaving, setEmployerSaving] = useState(false);
  const [agencySaving, setAgencySaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stepSaving, setStepSaving] = useState('');
  const [orderForm,setOrderForm]=useState({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});
  const [orderSubmitting,setOrderSubmitting]=useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/hr', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '無法讀取會員資料');
      if (active) setData(body);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    const workerId=profileWorker?.id||(data?.role==='worker'?data.workers?.[0]?.id:null);
    if(!workerId){setResumeViewPhoto('');return;}
    let active=true;fetch(`/api/hr/workers/${workerId}/resume-photo`,{cache:'no-store'}).then(async response=>response.ok?(await response.json()).photoDataUrl||'':'').then(photo=>{if(active)setResumeViewPhoto(photo);}).catch(()=>{if(active)setResumeViewPhoto('');});
    return()=>{active=false;};
  },[profileWorker?.id,data?.role,data?.workers?.[0]?.id]);

  useEffect(() => {
    if (data?.role !== 'agency' || data?.agencyType !== 'philippines') return;
    const savedPreference = localStorage.getItem('hr-language:philippines-agency');
    setLang(savedPreference === 'zh' ? 'zh' : 'en', { persist: false });
  }, [data?.role, data?.agencyType, setLang]);

  useEffect(() => {
    if (!progressWorker && !profileWorker && !workerEditorOpen && !workerToDelete) return;
    const closeOnEscape = event => { if (event.key === 'Escape') { setProgressWorker(null); setProfileWorker(null); setWorkerEditorOpen(false); setEditingWorker(null); setWorkerToDelete(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [progressWorker,profileWorker,workerEditorOpen,workerToDelete]);

  async function refresh() {
    const response = await fetch('/api/hr', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '無法讀取會員資料');
    setData(body);
    if (progressWorker) setProgressWorker(body.workers.find(item => Number(item.id) === Number(progressWorker.id)) || null);
  }
  async function beginWorkerEdit(item = null) {
    setEditingWorker(item);
    setWorkerEditorOpen(true);
    setWorkerForm(item ? { name:item.name||'', nationality:item.nationality||'', phone:item.phone||'', email:item.email||'', jobPreference:item.job_preference||'', notes:item.notes||'', resumeProfile:{...EMPTY_WORKER_RESUME,...(item.resume_profile||{})} } : { name:'', nationality:'', phone:'', email:'', jobPreference:'', notes:'', resumeProfile:{...EMPTY_WORKER_RESUME} });
    if(item?.id){setResumePhotoLoading(true);try{const response=await fetch(`/api/hr/workers/${item.id}/resume-photo`,{cache:'no-store'});if(response.ok){const body=await response.json();setWorkerForm(current=>({...current,resumeProfile:{...current.resumeProfile,photoDataUrl:body.photoDataUrl||''}}));}}catch{}finally{setResumePhotoLoading(false);}}
  }
  function updateWorkerResume(field,value) { setWorkerForm(current=>({...current,resumeProfile:{...current.resumeProfile,[field]:value}})); }
  async function importWorkerResumePdf(event) {
    const input=event.currentTarget,file=input.files?.[0];if(!file)return;
    setResumeImportMessage('');
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setResumeImportMessage('請選擇 PDF 履歷檔。');input.value='';return;}
    if(file.size>15*1024*1024){setResumeImportMessage('PDF 檔案需小於 15 MB。');input.value='';return;}
    setResumeImporting(true);
    let pdfDocument,worker;
    try{
      const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
      worker=new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.mjs',import.meta.url),{type:'module'});
      pdfjs.GlobalWorkerOptions.workerPort=worker;
      pdfDocument=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
      if(pdfDocument.numPages>20)throw new Error('履歷 PDF 最多可有 20 頁。');
      let importedPhoto='',firstPage;try{firstPage=await pdfDocument.getPage(1);}catch{}if(firstPage){try{importedPhoto=await extractEmbeddedResumePortrait(pdfjs,firstPage);}catch{}if(!importedPhoto)try{importedPhoto=await extractRenderedResumePortrait(pdfjs,firstPage);}catch{}}
      const pages=[];
      for(let pageNumber=1;pageNumber<=pdfDocument.numPages;pageNumber++){
        const page=await pdfDocument.getPage(pageNumber),content=await page.getTextContent(),rows=new Map();
        for(const item of content.items){if(!item.str?.trim())continue;const y=Math.round(item.transform?.[5]||0);const row=rows.get(y)||[];row.push({x:item.transform?.[4]||0,text:item.str});rows.set(y,row);}
        pages.push([...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join('\n'));
      }
      const extracted=pages.join('\n'),parsed=extractResumeFields(extracted);delete parsed.remarks;
      if(!extracted.trim())throw new Error('這份 PDF 沒有可讀取的文字，可能是掃描影像；請改用可選取文字的 PDF，或直接填寫欄位。');
      if(importedPhoto)parsed.photoDataUrl=importedPhoto;
      const educationSection=captureResumeSection(extracted,/EDUCATIONAL\s+BACK(?:GROUND|ROUND)|教育背景/i,/COURSE\s+COMPLETED|完成課程/i);
      const languageSection=captureResumeSection(extracted,/\bLANGUAGE\b|語言/i,/COOKING\s+SKILLS|烹飪/i);
      const cookingSection=captureResumeSection(extracted,/COOKING\s+SKILLS|烹飪/i,/HOME\s+ELECTRICAL\s+APPLIANCE\s+OPERATION|家電操作/i);
      const applianceSection=captureResumeSection(extracted,/HOME\s+ELECTRICAL\s+APPLIANCE\s+OPERATION|家電操作/i,/BABY\s+SITTING|嬰兒及兒童護理|嬰幼兒/i);
      if(educationSection){parsed.education=educationSection;parsed.educationLevels=/graduate|master|post.?graduate|研究所|碩士|博士|college|university|大學|專科/i.test(educationSection)?(/associate|專科/i.test(educationSection)&&!/university|大學/i.test(educationSection)?'專科':'大學'):/high\s*school|secondary|高中/i.test(educationSection)?'高中':/junior\s*high|middle\s*school|國中/i.test(educationSection)?'國中':/elementary|primary|小學/i.test(educationSection)?'小學':/vocational|職業培訓/i.test(educationSection)?'高中':'';}
      if(languageSection){
        const languageNames=[['English','English|英語'],['Tagalog','Tagalog|Filipino|菲語|塔加洛語'],['Cantonese','Cantonese|廣東話|粵語'],['Mandarin','Mandarin|Chinese|國語|中文']];
        parsed.languageOptions=languageNames.filter(([,pattern])=>new RegExp(pattern,'i').test(languageSection)).map(([name])=>name);
        const ratingLines=languageSection.split(/\r?\n/).map(normalizeResumeLine).filter(line=>/\b(good|fair|poor|native)\b/i.test(line)&&!/state if|speaking|writing|reading/i.test(line));
        const levels={};for(const [index,name] of parsed.languageOptions.entries()){const ratings=ratingLines.map(line=>line.match(/\b(native|good|fair|poor)\b/ig)||[]).flat().map(value=>value.toLowerCase());const rating=ratings[index];levels[name]=rating==='native'?'native':rating==='good'?'medium':'basic';}
        parsed.languages=JSON.stringify(levels);
      }
      if(cookingSection){const cookingMap=[['台灣','Taiwanese|Taiwan|台灣'],['廣東','Cantonese|廣東|粵菜'],['中國','Chinese Food|Chinese cuisine|中國菜|中菜'],['日本','Japanese|Japan|日本'],['泰國','Thai Food|Thai cuisine|Thai|泰國|泰菜'],['印度','Indian Food|Indian cuisine|Indian|印度'],['韓國','Korean|Korea|韓國|韓菜'],['菲律賓','Filipino Food|Filipino cuisine|Filipino|菲律賓|菲菜']];parsed.cookingSkills=cookingMap.filter(([,pattern])=>new RegExp(`(?:✓|✔|☑)\\s*(?:${pattern})`,'i').test(cookingSection)).map(([label])=>label).join('、');}
      if(applianceSection){parsed.applianceSkills=applianceSection;parsed.applianceOptions=[['Washing Machine|洗衣機','Washing Machine'],['Oven|烤箱|電焗爐','Oven'],['Vacuum Cleaner|吸塵器','Vacuum Cleaner'],['Microwave Oven|微波爐','Microwave Oven'],['Dish Washer|Dishwasher|洗碗機','Dish Washer'],['Others|其他','Others']].filter(([pattern])=>new RegExp(`(?:✓|✔|☑)\\s*(?:${pattern})`,'i').test(applianceSection)).map(([,label])=>label);}
      const childcareSection=captureResumeSection(extracted,/BABY\s+SITTING\s+AND\s+CHILDREN\s+CARE|嬰兒及兒童護理/i,/PERSONAL\s+EXPERIENCE|個人經驗/i);
      if(childcareSection){const skills=[['Bathing','Bathing|洗澡'],['Changing diapers','Changing diapers|Change diaper|換尿布'],['Sterilizing utensils','Sterilizing utensils|Sterilize utensils|消毒'],['Feeding','Feeding|餵食'],['Taking temperature','Taking temperature|取體溫'],['Others','Others|其他']];parsed.childcareSkills=skills.filter(([label,pattern])=>new RegExp(`(?:✓|✔|☑)\\s*(?:${pattern})`,'i').test(childcareSection)).map(([label])=>label).join('、');}
      if(parsed.skinComplexion){const tone=parsed.skinComplexion.toLowerCase();parsed.skinComplexion=/white|fair|light|白/i.test(tone)?'白':/yellow|medium|tan|黃/i.test(tone)?'黃':/black|dark|黑/i.test(tone)?'黑':parsed.skinComplexion;}
      if(parsed.height){const numeric=Number(parsed.height.match(/\d{2,3}/)?.[0]);parsed.height=!Number.isFinite(numeric)?'':numeric<145?'145以下':numeric>180?'181以上':String(numeric);}
      if(parsed.weight){const numeric=Number(parsed.weight.match(/\d{2,3}/)?.[0]);parsed.weight=!Number.isFinite(numeric)?'':numeric<40?'39以下':numeric>70?'71以上':String(numeric);}
      if(parsed.maritalStatus){const status=parsed.maritalStatus.toLowerCase();parsed.maritalStatus=/married|結婚/i.test(status)?'已結婚':/partner|relationship|伴侶/i.test(status)?'有伴侶':/single|未婚|單身/i.test(status)?'單身':parsed.maritalStatus;}
      for(const field of ['numberOfChildren','brotherCount','sisterCount'])if(parsed[field]){const value=parsed[field].toLowerCase();parsed[field]=/none|no children|無|沒有/.test(value)?'0':parsed[field].match(/\d{1,2}/)?.[0]||parsed[field];}
      const topLevel={};
      const textLines=extracted.split(/\r?\n/).map(normalizeResumeLine).filter(Boolean);
      const findLabeled=(labels)=>{for(const line of textLines){for(const label of labels){const match=line.match(new RegExp(`(?:^|\\s)${label}\\s*[:：\\-]?\\s*(.+)$`,'i'));if(match&&match[1].trim())return stripRepeatedPatternLabel(trimAtNextResumeLabel(match[1]),labels);}}return '';};
      const name=findLabeled(['Name','Full Name','Applicant Name','姓名']);
      const nationality=findLabeled(['Nationality','國籍']);
      const phone=findLabeled(['Mobile','Mobile No\\.?','Telephone','Phone','Contact No\\.?','聯絡電話','電話']);
      const email=findLabeled(['Email','E-mail']);
      const jobPreference=findLabeled(['Position Applied','Job Preference','Preferred Position','工作意向']);
      if(name)topLevel.name=name;if(nationality)topLevel.nationality=nationality;if(phone)topLevel.phone=phone;if(email)topLevel.email=email;
      if(jobPreference){const normalized=jobPreference.toLowerCase();topLevel.jobPreference=/helper|domestic|housemaid/.test(normalized)?'家庭幫傭':/institution|facility|caregiver|caregiving/.test(normalized)?'機構看護工':/home care|caretaker|care worker|care assistant/.test(normalized)?'家庭看護':/factory|technical/.test(normalized)?'工廠技術工':/farmer|farm worker|agricultur/.test(normalized)?'農工':jobPreference;}
      if(parsed.gender)parsed.gender=/female|\bf\b|女性|女/i.test(parsed.gender)?'female':/male|\bm\b|男性|男/i.test(parsed.gender)?'male':parsed.gender;
      if(parsed.religion){const religion=parsed.religion.trim();parsed.religion=/catholic|天主教/i.test(religion)?'天主教':/christian|基督教|基督徒/i.test(religion)?'基督教':`其他：${religion}`;}
      for(const field of WORKER_RESUME_YES_NO){const value=parsed[field];if(value){if(/^(yes|y|true)$/i.test(value))parsed[field]='是';else if(/^(no|n|false)$/i.test(value))parsed[field]='否';}}
      if(parsed.birthDate&&/^\d{4}-\d{2}-\d{2}$/.test(parsed.birthDate)){}else if(parsed.birthDate){const date=new Date(parsed.birthDate);if(!Number.isNaN(date.getTime()))parsed.birthDate=date.toISOString().slice(0,10);}
      setWorkerForm(current=>({...current,...topLevel,resumeProfile:{...current.resumeProfile,...parsed}}));
      setResumeImportMessage(importedPhoto?'已讀取履歷文字並自動擷取照片；請檢查資料與照片後再儲存。':'已讀取履歷文字並填入可辨識欄位；未找到可用照片，請確認並手動上傳。');
    }catch(error){setResumeImportMessage(error.message||'無法讀取此 PDF，請確認檔案未加密且格式正確。');}
    finally{try{await pdfDocument?.destroy();}catch{}worker?.terminate();setResumeImporting(false);input.value='';}
  }
  function uploadWorkerPhoto(event) {
    const file=event.target.files?.[0];if(!file)return;
    if(!['image/jpeg','image/png'].includes(file.type)||file.size>1500000){setError('履歷照片請使用 JPG 或 PNG，檔案需小於 1.5 MB。');event.target.value='';return;}
    const reader=new FileReader();reader.onload=()=>updateWorkerResume('photoDataUrl',String(reader.result||''));reader.onerror=()=>setError('讀取履歷照片失敗。');reader.readAsDataURL(file);
  }
  async function downloadWorkerResume(worker) {
    setResumePdfLoading(true);
    try {let photoDataUrl='';if(worker?.id){const response=await fetch(`/api/hr/workers/${worker.id}/resume-photo`,{cache:'no-store'});if(response.ok)photoDataUrl=(await response.json()).photoDataUrl||'';}await createWorkerResumePdf({...worker,resume_profile:{...(worker.resume_profile||{}),photoDataUrl}});}
    catch (err) { setError(err.message||'履歷 PDF 產生失敗。'); }
    finally { setResumePdfLoading(false); }
  }
  function beginEmployerEdit(item = null) {
    setEditingEmployer(item);
    setEmployerForm(item ? { name:item.name||'', employerType:item.employer_type||'other', contactName:item.contact_name||'', phone:item.phone||'', email:item.email||'', address:item.address||'', notes:item.notes||'' } : { name:'', employerType:'home_care', contactName:'', phone:'', email:'', address:'', notes:'' });
  }
  async function saveEmployer(event) {
    event.preventDefault(); setEmployerSaving(true); setError('');
    try {
      const response=await fetch('/api/hr',{method:editingEmployer?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'employer',...(editingEmployer?{id:editingEmployer.id}:{}),...employerForm})});
      const body=await response.json(); if(!response.ok)throw new Error(body.error||'儲存雇主資料失敗');
      setEditingEmployer(null); await refresh();
    } catch(err){setError(err.message);} finally{setEmployerSaving(false);}
  }
  async function toggleEmployer(item) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'employer',id:item.id,active:item.status!=='active'})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新雇主狀態失敗');return;} await refresh();
  }
  async function saveEmployerAgency(agencyId) {
    setOrderForm(current=>({...current,brokerMemberId:''}));setAgencySaving(true); setError('');
    try {const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'employer-agency',agencyId})});const body=await response.json();if(!response.ok)throw new Error(body.error||'更新所屬仲介失敗');await refresh();}
    catch(err){setError(err.message);}finally{setAgencySaving(false);}
  }
  async function saveWorker(event) {
    event.preventDefault(); setWorkerSaving(true); setError('');
    try {
      const response = await fetch('/api/hr', { method: editingWorker ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'worker', ...(editingWorker ? {id:editingWorker.id} : {}), ...workerForm }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '儲存工作者資料失敗');
      setResumeViewPhoto(workerForm.resumeProfile.photoDataUrl||'');
      setEditingWorker(null); setWorkerEditorOpen(false); await refresh();
    } catch (err) { setError(err.message); } finally { setWorkerSaving(false); }
  }
  async function toggleWorker(item) {
    const response = await fetch('/api/hr', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'worker',id:item.id,active:item.status!=='active'}) });
    const body = await response.json(); if (!response.ok) { setError(body.error || '更新工作者狀態失敗'); return; } await refresh();
  }
  async function deleteWorker(item) {
    setWorkerToDelete(item);
    setDeleteWorkerError('');
  }
  async function confirmDeleteWorker() {
    if (!workerToDelete) return;
    try {
      const response=await fetch(`/api/hr?id=${workerToDelete.id}`,{method:'DELETE'}); const body=await response.json();
      if (!response.ok) { setDeleteWorkerError(response.status===409?'':(body.error || '刪除工作者失敗')); return; }
      setWorkerToDelete(null); setDeleteWorkerError(''); setError(''); await refresh();
    } catch { setDeleteWorkerError('刪除失敗，請確認網路連線後再試。'); }
  }
  async function uploadDocument(event, requirement) {
    event.preventDefault(); const formElement=event.currentTarget; setUploading(true); setError('');
    try {
      const form = new FormData(formElement); form.set('requirementId',String(requirement.id));
      const response = await fetch('/api/hr/documents',{method:'POST',body:form}); const body=await response.json();
      if (!response.ok) throw new Error(body.error || '文件上傳失敗');
      formElement.reset(); await refresh();
    } catch(err) { setError(err.message); } finally { setUploading(false); }
  }
  async function setApplicability(requirement) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'requirement-applicability',requirementId:requirement.id,applicable:!requirement.applicable})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新文件適用狀態失敗');return;} await refresh();
  }
  async function reviewDocument(requirement, decision) {
    const reason=decision==='returned'?window.prompt('請輸入補件原因，申請人會看到這段說明。')?.trim():'';
    if(decision==='returned'&&!reason)return;
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'review',submissionId:requirement.latest_submission_id,decision,reason})});
    const body=await response.json();if(!response.ok){setError(body.error||'文件審核失敗');return;}await refresh();
  }
  async function saveApplicationStep(event, step) {
    event.preventDefault(); const form=new FormData(event.currentTarget);setStepSaving(`${step.case_id}:${step.step_key}`);setError('');
    try {const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'application-step',caseId:step.case_id,stepKey:step.step_key,startedOn:form.get('startedOn'),completedOn:form.get('completedOn'),note:form.get('note')})});const body=await response.json();if(!response.ok)throw new Error(body.error||'儲存申請程序失敗');await refresh();}
    catch(err){setError(err.message);}finally{setStepSaving('');}
  }
  async function updateCaseStatus(item,status) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'case',id:item.id,status,expectedStartDate:item.expected_start_date?String(item.expected_start_date).slice(0,10):'',notes:item.notes||''})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新案件狀態失敗');return;} await refresh();
  }
  async function submitWorkflow(payload, successMessage='') {
    setError('');try{const response=await fetch('/api/hr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.error||'送出失敗');if(successMessage)setError(successMessage);await refresh();return body;}catch(err){setError(err.message);return null;}
  }
  async function submitOrder(event){event.preventDefault();const agencyId=data.employers[0]?.agency_id;if(!agencyId)return;setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order',jobType:orderForm.jobType,headcount:Number(orderForm.headcount),description:orderForm.description,expectedStartDate:orderForm.expectedStartDate,taiwanAgencyAssignments:[{agencyId,brokerMemberId:orderForm.brokerMemberId||null}]});if(result)setOrderForm({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});setOrderSubmitting(false);}
  async function selectOrderWorker(order,worker,routeId){await submitWorkflow({type:'job-order-employer-candidate',orderId:order.id,routeId,workerId:worker.id});}
  async function interviewDecision(candidate,status){const confirmText=status==='passed'?'確認錄用並建立正式申辦案件？':status==='rejected'?'確認未錄用此人選？':'安排此人選面試？';if(!window.confirm(confirmText))return;const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'job-order-candidate-interview',candidateId:candidate.id,status})});const body=await response.json();if(!response.ok){setError(body.error||'更新面試結果失敗');return;}setError('');await refresh();}

  if (error && !data) return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><section className="hr-member-card"><span>克雷迅人力管理</span><h1>無法載入會員資料</h1><p>{error}</p><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></section></main>;
  if (!data) return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><section className="hr-member-card"><span>克雷迅人力管理</span><h1>載入中</h1><p>正在確認此帳號可存取的案件資料。</p></section></main>;

  if (data.role === 'pending') {
    const roles = { worker: '工人', employer: '雇主', agency: '仲介' };
    async function requestMembership(event) {
      event.preventDefault();
      setRequesting(true);
      setError('');
      try {
        const response = await fetch('/api/hr/member-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestedRole }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '申請送出失敗');
        setData(current => ({ ...current, pendingApproval: true, requestedRole: body.requestedRole }));
      } catch (err) { setError(err.message); }
      finally { setRequesting(false); }
    }
    return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><header className="hr-member-header"><div><span>克雷迅人力管理</span><h1>會員類型審核</h1><p>{data.actor?.name || actor.name} · 尚未指派會員類型</p></div><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></header><section className="hr-member-card hr-member-pending">
      {data.pendingApproval ? <><h2>申請已送出，等待管理者審核</h2><p>申請類型：<strong>{roles[data.requestedRole] || '尚未選擇'}</strong></p><p>管理者核准並指派所屬資料後，你就能使用對應的會員工作區。</p></> : <><h2>選擇要申請的會員類型</h2><p>送出後會由管理者確認身分並指派所屬資料。審核完成前不會開放案件或會員資料。</p><form onSubmit={requestMembership}><label>申請類型<select value={requestedRole} onChange={event => setRequestedRole(event.target.value)}><option value="worker">工人</option><option value="employer">雇主</option><option value="agency">仲介</option></select></label><button disabled={requesting}>{requesting ? '送出中…' : '送出審核申請'}</button></form></>}
      {error && <p role="alert" className="hr-request-error">{error}</p>}
    </section></main>;
  }

  const viewedWorker = data.role === 'worker' ? data.workers[0] : null;
  const isPhilippinesOperator = data.role === 'agency' && data.agencyType === 'philippines';
  const isTaiwanOperator = data.role === 'agency' && data.agencyType === 'taiwan';
  const canManageCaseProgress = data.role === 'agency';
  const workerCases = viewedWorker ? data.cases.filter(item => Number(item.worker_id) === Number(viewedWorker.id)) : ['agency','employer'].includes(data.role) ? data.cases : [];
  const workerRequirements = data.requirements.filter(item => workerCases.some(row => Number(row.id) === Number(item.case_id)));
  const activeTaiwanAgencies=data.agencies.filter(item=>item.active&&item.agency_type==='taiwan');
  const activePhilippinesAgencies=data.agencies.filter(item=>item.active&&item.agency_type==='philippines');
  return <main className="hr-member-shell" data-hr-translatable-root data-hr-language-profile={isPhilippinesOperator ? 'philippines-agency' : undefined}><HrLanguageTools />
    <header className="hr-member-header"><div><span>克雷迅人力管理</span><h1>{data.role==='agency'?(data.agencyType==='taiwan'?'業務':'Staff'):(labels[data.role] || data.roleName)}工作區</h1><p>{actor.name}</p></div><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></header>
    <HrReminders onOpenChat={roomId=>{setActiveWorkspaceTab('chat');window.dispatchEvent(new CustomEvent('hr:open-chat-room',{detail:{roomId}}));}} onOpenProgress={workerId=>{const worker=data.workers.find(item=>Number(item.id)===Number(workerId));if(worker)setProgressWorker(worker);}} />
    <nav className="workspace-tabs" aria-label="工作區分頁">{[['basic','基本資料'],['agencyEmployer','仲介／雇主資料'],['documents','必要文件'],['process','來台程序'],['chat','聊天室']].map(([tab,label])=><button key={tab} type="button" className={activeWorkspaceTab===tab?'active':''} aria-current={activeWorkspaceTab===tab?'page':undefined} onClick={()=>setActiveWorkspaceTab(tab)}>{label}</button>)}</nav>
    {activeWorkspaceTab==='basic'&&data.role!=='worker'&&<section className="hr-member-card"><h2>基本資料</h2><dl className="workspace-basic-fields"><div><dt>姓名</dt><dd>{data.actor?.name||actor.name||'—'}</dd></div><div><dt>Email</dt><dd>{data.actor?.email||actor.email||'—'}</dd></div><div><dt>會員類型</dt><dd>{data.role==='agency'?(data.agencyType==='taiwan'?'台灣仲介業務':'菲律賓仲介 Staff'):data.roleName||'會員'}</dd></div>{data.role==='employer'&&data.employers[0]&&<div><dt>雇主／客戶</dt><dd>{data.employers[0].name}</dd></div>}{data.role==='agency'&&<div><dt>所屬仲介</dt><dd>{data.agencies.find(item=>Number(item.id)===Number(data.agencyId))?.name||'—'}</dd></div>}</dl></section>}
    {error&&<p className="hr-request-error" role="alert">{error}</p>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role==='employer'&&<section className="hr-member-card employer-orders"><div className="orders-heading"><div><span className="orders-eyebrow">EMPLOYER PORTAL</span><h2>工作需求單</h2><p>先建立需求單，待所屬仲介轉交菲律賓仲介後，會依工作類別顯示未媒合工人供你挑選。</p></div><span className="orders-count">{data.jobOrders.length} 張需求單</span></div><form className="worker-form order-form" onSubmit={submitOrder}>
      <label>工作類型<select value={orderForm.jobType} onChange={e=>setOrderForm({...orderForm,jobType:e.target.value})}><option>家庭看護</option><option>家庭幫傭</option><option>機構看護工</option><option>工廠技術工</option><option>農工</option></select></label>
      <label>需求人數<input type="number" min="1" max="100" required value={orderForm.headcount} onChange={e=>setOrderForm({...orderForm,headcount:e.target.value})}/></label>
      <label>預計到職日期<input type="date" value={orderForm.expectedStartDate} onChange={e=>setOrderForm({...orderForm,expectedStartDate:e.target.value})}/></label>
      <label className="form-wide">工作內容／條件<textarea rows="3" value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})}/></label>
      {(()=>{const agencyId=Number(data.employers[0]?.agency_id||0);const employerAgency=activeTaiwanAgencies.find(item=>Number(item.id)===agencyId);return <><label className="form-wide">所屬台灣仲介<input value={employerAgency?.name||'請先在下方選擇所屬台灣仲介'} readOnly/></label>{employerAgency&&<label>指定業務（選填）<select value={orderForm.brokerMemberId} onChange={e=>setOrderForm(current=>({...current,brokerMemberId:e.target.value}))}><option value="">不指定業務</option>{data.agencyContacts.filter(member=>Number(member.agency_id)===agencyId).map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}<button disabled={orderSubmitting||!employerAgency}>{orderSubmitting?'送出中…':employerAgency?'建立需求單並送交所屬仲介':'請先選擇所屬仲介'}</button></>})()}</form>
      <div className="orders-section"><div className="orders-section-heading"><h3>我的需求與推薦人選</h3><span>{data.jobOrders.length} 張需求單</span></div>{data.jobOrders.length?data.jobOrders.map(order=>{const dispatches=data.orderAgencies.filter(row=>Number(row.job_order_id)===Number(order.id));const orderDispatchIds=new Set(dispatches.map(row=>Number(row.id)));const orderRoutes=data.orderRoutes.filter(route=>orderDispatchIds.has(Number(route.order_agency_id)));const selectedWorkerIds=new Set(data.orderCandidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id)).map(candidate=>Number(candidate.worker_id)));const matchingWorkers=order.status==='open'?(data.availableWorkers||[]).filter(worker=>worker.job_preference===order.job_type&&!selectedWorkerIds.has(Number(worker.id))&&orderRoutes.some(route=>Number(route.philippines_agency_id)===Number(worker.agency_id))):[];const statusLabel=({open:'媒合中',sent:'已送出',filled:'已額滿',cancelled:'已取消'})[order.status]||order.status;return <article className="job-order-card" key={order.id}><header className="job-order-header"><div><span className="job-order-number">需求單 #{order.id}</span><h4>{order.job_type}</h4></div><span className={`order-status status-${order.status}`}>{statusLabel}</span></header><div className="job-order-facts"><div><small>需求人數</small><strong>{order.headcount} 人</strong></div><div><small>預計到職</small><strong>{order.expected_start_date?String(order.expected_start_date).slice(0,10):'未指定'}</strong></div><div><small>所屬仲介</small><strong>{dispatches[0]?.taiwan_agency_name||'等待指派'}</strong></div></div>{order.description&&<p className="job-order-description">{order.description}</p>}<div className="candidate-list"><h5>符合此工作類別且尚未有雇主的工人（{matchingWorkers.length}）</h5>{matchingWorkers.length?matchingWorkers.map(worker=>{const route=orderRoutes.find(item=>Number(item.philippines_agency_id)===Number(worker.agency_id));return <div className="candidate-card" key={`available-${worker.id}`}><div><strong>{worker.name}</strong><small>{worker.nationality||'—'} · {data.agencies.find(agency=>Number(agency.id)===Number(worker.agency_id))?.name||'菲律賓仲介'}</small></div><div className="candidate-actions"><button type="button" onClick={()=>setProfileWorker(worker)}>查看履歷</button><button type="button" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(worker)}>下載履歷 PDF</button><button type="button" onClick={()=>void selectOrderWorker(order,worker,route.id)}>挑選工人</button></div></div>}):<p>{orderRoutes.length?'目前沒有符合此工作類別的未媒合工人。':'等待所屬仲介轉交菲律賓仲介；轉交後會顯示符合職類的工人。'}</p>}</div><div className="order-agency-list">{dispatches.length?dispatches.map(dispatch=>{const routes=data.orderRoutes.filter(route=>Number(route.order_agency_id)===Number(dispatch.id));const candidates=data.orderCandidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id)&&Number(candidate.taiwan_agency_id)===Number(dispatch.taiwan_agency_id));return <section className="order-agency-card" key={dispatch.id}><div className="order-agency-heading"><div><small>台灣仲介機構</small><strong>{dispatch.taiwan_agency_name}</strong></div><span>{dispatch.broker_name?`業務：${dispatch.broker_name}`:'尚未指定業務'}</span></div><p className="order-routing">菲律賓媒合：{routes.map(route=>route.philippines_agency_name).join('、')||'等待仲介轉交'}</p>{candidates.length>0&&<div className="candidate-list"><h5>推薦人選與面試</h5>{candidates.map(candidate=><div className="candidate-card" key={candidate.id}><div><strong>{candidate.worker_name}</strong><small>{candidate.philippines_agency_name} · {({proposed:'待面試',scheduled:'已安排面試',passed:'錄用',rejected:'未錄用'})[candidate.status]||candidate.status}</small></div>{candidate.status!=='passed'&&candidate.status!=='rejected'&&<div className="candidate-actions"><button type="button" onClick={()=>interviewDecision(candidate,'scheduled')}>安排面試</button><button type="button" onClick={()=>interviewDecision(candidate,'passed')}>錄用</button><button type="button" className="candidate-reject" onClick={()=>interviewDecision(candidate,'rejected')}>未錄用</button></div>}</div>)}</div>}</section>}) : <div className="order-awaiting"><span>1</span><div><strong>等待仲介機構接單</strong><small>需求已建立，仲介受理後會顯示在這裡。</small></div></div>}</div></article>}):<div className="orders-empty"><span>＋</span><strong>目前還沒有需求單</strong><p>填寫上方需求並選擇仲介，送出後即可在這裡追蹤進度。</p></div>}</div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&isTaiwanOperator&&data.orderAgencies.length>0&&<section className="hr-member-card"><h2>待轉交的雇主需求</h2>{data.orderAgencies.map(dispatch=>{const order=data.jobOrders.find(row=>Number(row.id)===Number(dispatch.job_order_id));if(!order)return null;return <article className="worker-case" key={dispatch.id}><strong>需求 #{order.id} · {order.employer_name} · {order.job_type} · {order.headcount} 人</strong><p>{order.description||'未填工作說明'}</p><p>負責業務：{dispatch.broker_name||'未指定，由機構分派'}</p><form className="agency-choice" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submitWorkflow({type:'job-order-route',orderAgencyId:dispatch.id,philippinesAgencyIds:f.getAll('philippinesAgencyIds')});}}><label>轉交菲律賓仲介<select name="philippinesAgencyIds" multiple required>{activePhilippinesAgencies.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button>轉交選取仲介</button></form></article>})}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&isPhilippinesOperator&&data.orderRoutes.length>0&&<section className="hr-member-card"><h2>收到的工作需求與推薦工人</h2>{data.orderRoutes.map(route=>{const order=data.jobOrders.find(row=>Number(row.id)===Number(route.job_order_id));const dispatch=data.orderAgencies.find(row=>Number(row.id)===Number(route.order_agency_id));if(!order)return null;const eligibleWorkers=data.workers.filter(w=>Number(w.agency_id)===Number(data.agencyId)&&w.status==='active'&&!data.cases.some(c=>Number(c.worker_id)===Number(w.id)));return <article className="worker-case" key={route.id}><strong>需求 #{order.id} · {order.employer_name} · {order.job_type} · {order.headcount} 人</strong><p>{order.description||'未填工作說明'}</p><p>承接機構：{route.philippines_agency_name}（Staff 作業） · 台灣 Broker：{dispatch?.broker_name||'未指定'}</p><form className="agency-choice" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submitWorkflow({type:'job-order-candidate',routeId:route.id,workerId:f.get('workerId'),notes:f.get('notes')});}}><label>推薦所屬工人<select name="workerId" required><option value="">選擇工人</option>{eligibleWorkers.map(w=><option key={w.id} value={w.id}>{w.name} · {w.job_preference||'未填意向'}</option>)}</select></label>{eligibleWorkers.length===0&&<small>目前沒有尚未建立案件的可用工人。</small>}<label>推薦說明<input name="notes"/></label><button disabled={!eligibleWorkers.length}>推薦給雇主面試</button></form>{data.orderCandidates.filter(c=>Number(c.route_id)===Number(route.id)).map(c=><p key={c.id}>{c.worker_name} · {({proposed:'待雇主安排面試',scheduled:'已安排面試',passed:'已錄用',rejected:'未錄用'})[c.status]}</p>)}</article>})}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&isTaiwanOperator && !editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>所屬雇主</h2><button onClick={()=>beginEmployerEdit()}>新增雇主</button></div>{data.employers.length?<div className="hr-member-table-wrap"><table><thead><tr><th>雇主／客戶</th><th>類型</th><th>聯絡人</th><th>電話</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.employers.map(item=><tr key={item.id}><td>{item.name}</td><td>{{home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'}[item.employer_type]||'其他'}</td><td>{item.contact_name||'—'}</td><td>{item.phone||'—'}</td><td>{item.status==='active'?'啟用':'停用'}</td><td>{Number(item.agency_id)===Number(data.agencyId)&&<><button className="table-action" onClick={()=>beginEmployerEdit(item)}>編輯</button><button className="table-action" onClick={()=>toggleEmployer(item)}>{item.status==='active'?'停用':'啟用'}</button></>}</td></tr>)}</tbody></table></div>:<p>目前尚無所屬雇主。</p>}</section>}
    {editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>{editingEmployer.id?'編輯雇主':'新增雇主'}</h2><button className="light-action" onClick={()=>setEditingEmployer(null)}>取消</button></div><form className="worker-form" onSubmit={saveEmployer}><label>雇主／客戶名稱<input required value={employerForm.name} onChange={event=>setEmployerForm(current=>({...current,name:event.target.value}))}/></label><label>雇主類型<select value={employerForm.employerType} onChange={event=>setEmployerForm(current=>({...current,employerType:event.target.value}))}><option value="home_care">家庭看護</option><option value="factory">工廠</option><option value="domestic_helper">家庭幫傭</option><option value="other">其他</option></select></label>{[['contactName','聯絡人'],['phone','電話'],['email','Email'],['address','地址']].map(([field,label])=><label key={field}>{label}<input type={field==='email'?'email':'text'} value={employerForm[field]} onChange={event=>setEmployerForm(current=>({...current,[field]:event.target.value}))}/></label>)}<label className="form-wide">備註<textarea rows="3" value={employerForm.notes} onChange={event=>setEmployerForm(current=>({...current,notes:event.target.value}))}/></label><button disabled={employerSaving}>{employerSaving?'儲存中…':'儲存雇主'}</button></form></section>}
    {activeWorkspaceTab==='agencyEmployer'&&isTaiwanOperator && !!data.cases.length && <section className="hr-member-card"><h2>雇主案件與工作者進度</h2><div className="hr-member-table-wrap"><table><thead><tr><th>案件編號</th><th>雇主</th><th>工作者</th><th>進度</th><th>案件狀態</th><th>操作</th></tr></thead><tbody>{data.cases.map(item=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(item.id));const completed=steps.filter(step=>step.started_on||step.completed_on||step.note).length;return <tr key={item.id}><td>{item.case_number}</td><td>{item.employer_name}</td><td>{item.worker_name}</td><td>{completed}/{steps.length} 項已更新</td><td><select className="case-status" value={item.status} onChange={event=>updateCaseStatus(item,event.target.value)}><option value="open">進行中</option><option value="on_hold">暫停</option><option value="closed">結案</option></select></td><td><button className="table-action" onClick={()=>{const worker=data.workers.find(row=>Number(row.id)===Number(item.worker_id));if(worker)setProgressWorker(worker)}}>查看進度</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'agency' && !editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>{isPhilippinesOperator?'所屬工作者與申辦進度':'案件相關工作者'}</h2>{isPhilippinesOperator&&<button onClick={()=>beginWorkerEdit()}>新增工作者</button>}</div>{data.workers.length?<div className="hr-member-table-wrap"><table><thead><tr><th>姓名</th><th>國籍</th><th>工作意向</th><th>申請案件</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.workers.map(item=>{const caseCount=data.cases.filter(row=>Number(row.worker_id)===Number(item.id)).length;const ownsWorker=Number(item.agency_id)===Number(data.agencyId);return <tr key={item.id}><td><button className="worker-link" onClick={()=>setProfileWorker(item)}>{item.name}</button></td><td>{item.nationality||'—'}</td><td>{item.job_preference||'—'}</td><td>{caseCount?`${caseCount} 件`:'尚未媒合'}</td><td>{item.status==='active'?'啟用':'停用'}</td><td><button className="table-action" onClick={()=>caseCount?setProgressWorker(item):setProfileWorker(item)}>{caseCount?'查看進度':'查看資料'}</button><button className="table-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(item)}>下載履歷 PDF</button>{isPhilippinesOperator&&ownsWorker&&<><button className="table-action" onClick={()=>beginWorkerEdit(item)}>編輯</button><button className="table-action" onClick={()=>toggleWorker(item)}>{item.status==='active'?'停用':'啟用'}</button><button className="table-action" onClick={()=>deleteWorker(item)}>刪除</button></>}</td></tr>})}</tbody></table></div>:<p>目前沒有相關工作者。</p>}</section>}
    {workerEditorOpen&&<div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setWorkerEditorOpen(false);setEditingWorker(null)}}}><section className="progress-modal worker-edit-modal" role="dialog" aria-modal="true" aria-labelledby="worker-edit-title"><header className="progress-modal-header"><div><span>工作者資料</span><h2 id="worker-edit-title">{editingWorker?.id?'編輯工作者':'新增工作者'}</h2></div><button type="button" className="progress-modal-close" aria-label="關閉工作者表單" onClick={()=>{setWorkerEditorOpen(false);setEditingWorker(null)}}>×</button></header><form className="worker-form worker-edit-form" onSubmit={saveWorker}><div className="resume-form-section form-wide"><h3>基本聯絡資料</h3>{data.role==='worker'&&<div className="resume-import-box"><label>上傳 PDF 履歷更新資料<input type="file" accept="application/pdf,.pdf" onChange={importWorkerResumePdf} disabled={resumeImporting||resumePhotoLoading}/></label><small>讀取到的欄位會先填入表單；確認內容後按「儲存工作者」才會更新。支援可選取文字的 PDF，檔案上限 15 MB。</small>{resumeImporting&&<p role="status">正在讀取履歷 PDF…</p>}{resumeImportMessage&&<p role="status">{resumeImportMessage}</p>}</div>}<div className="resume-form-grid"><PersonNameFields name="name" label="姓名" value={workerForm.name} required onChange={name=>setWorkerForm(current=>({...current,name}))}/><label>國籍<input value={workerForm.nationality} onChange={event=>setWorkerForm(current=>({...current,nationality:event.target.value}))}/></label><label>聯絡電話<input value={workerForm.phone} onChange={event=>setWorkerForm(current=>({...current,phone:event.target.value}))}/></label><label>Email<input type="email" value={workerForm.email} onChange={event=>setWorkerForm(current=>({...current,email:event.target.value}))}/></label><label>工作意向<select required value={workerForm.jobPreference} onChange={event=>setWorkerForm(current=>({...current,jobPreference:event.target.value}))}><option value="">請選擇</option><option value="家庭幫傭">家庭幫傭</option><option value="家庭看護">家庭看護</option><option value="工廠技術工">工廠技術工</option><option value="農工">農工</option><option value="機構看護工">機構看護工</option></select></label><label className="resume-photo-field">履歷照片<input type="file" accept="image/jpeg,image/png" onChange={uploadWorkerPhoto}/>{workerForm.resumeProfile.photoDataUrl&&<img src={workerForm.resumeProfile.photoDataUrl} alt="履歷照片預覽"/>}</label></div></div>{WORKER_RESUME_GROUPS.map(group=><fieldset className="resume-form-section form-wide" key={group.title}><legend>{group.title}</legend><div className="resume-form-grid">{group.fields.map(([field,label])=><ResumeFieldEditor key={field} field={field} label={label} workerForm={workerForm} updateWorkerResume={updateWorkerResume}/>) }</div></fieldset>)}<label className="form-wide">備註<textarea rows="3" value={workerForm.notes} onChange={event=>setWorkerForm(current=>({...current,notes:event.target.value}))}/></label><div className="worker-edit-actions"><button type="button" className="worker-edit-cancel" onClick={()=>{setWorkerEditorOpen(false);setEditingWorker(null)}}>取消</button><button disabled={workerSaving||resumePhotoLoading||resumeImporting}>{resumePhotoLoading?'讀取照片中…':resumeImporting?'讀取履歷中…':workerSaving?'儲存中…':'儲存工作者'}</button></div></form></section></div>}
    {workerToDelete&&<div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setWorkerToDelete(null);setDeleteWorkerError('')}}}><section className="progress-modal delete-worker-modal" role="dialog" aria-modal="true" aria-labelledby="delete-worker-title"><header className="progress-modal-header"><div><span>刪除工作者</span><h2 id="delete-worker-title">確定刪除「{workerToDelete.name}」？</h2></div><button type="button" className="progress-modal-close" aria-label="關閉刪除確認" onClick={()=>{setWorkerToDelete(null);setDeleteWorkerError('')}}>×</button></header><div className="progress-modal-body"><p className="delete-worker-error">已有案件或會員帳號的工作者無法刪除</p>{deleteWorkerError&&<p className="delete-worker-error" role="alert">{deleteWorkerError}</p>}<div className="worker-edit-actions"><button type="button" className="worker-edit-cancel" onClick={()=>{setWorkerToDelete(null);setDeleteWorkerError('')}}>取消</button><button type="button" className="worker-delete-confirm" onClick={confirmDeleteWorker}>確認刪除</button></div></div></section></div>}
    {activeWorkspaceTab==='basic'&&data.role === 'worker' && viewedWorker && <section className="hr-member-card resume-profile-card"><header className="resume-profile-header"><div><span className="orders-eyebrow">WORKER PROFILE</span><h2>我的資料</h2><p>完善履歷資料，讓合作仲介與雇主了解你的技能和工作經驗。</p></div><div><button type="button" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(viewedWorker)}>{resumePdfLoading?'產生中…':'下載履歷 PDF'}</button><button type="button" onClick={()=>beginWorkerEdit(viewedWorker)}>編輯履歷</button></div></header><div className="worker-detail resume-contact"><p>姓名：{viewedWorker.name}</p><p>國籍：{viewedWorker.nationality||'—'}</p><p>電話：{viewedWorker.phone||'—'}</p><p>Email：{viewedWorker.email||'—'}</p><p>工作意向：{viewedWorker.job_preference||'—'}</p></div>{resumeViewPhoto&&<img className="resume-profile-photo" src={resumeViewPhoto} alt="履歷照片"/>}<WorkerResumeSections profile={viewedWorker.resume_profile}/></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role==='worker'&&workerCases.length>0&&<section className="hr-member-card"><h2>台灣仲介 Broker</h2>{workerCases.map(item=><p key={item.id}>{item.case_number} · {item.broker_name||'尚未指定'}</p>)}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'employer' && data.employers[0] && <section className="hr-member-card employer-agency-card"><div><h2>所屬台灣仲介</h2><p>選擇後會立即更新所屬機構。</p></div><label className="employer-agency-select">選擇仲介<select name="agencyId" defaultValue={data.employers[0].agency_id||''} disabled={agencySaving} onChange={event=>void saveEmployerAgency(event.target.value||null)}><option value="">尚未選擇</option>{data.agencies.filter(item=>item.active&&item.agency_type==='taiwan').map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>{agencySaving&&<small>更新中…</small>}</label></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'employer' && !!data.cases.length && <section className="hr-member-card"><h2>所屬仲介案件與配工工作者</h2><div className="hr-member-table-wrap"><table><thead><tr><th>案件編號</th><th>工作者</th><th>進度</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.cases.map(item=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(item.id));const completed=steps.filter(step=>step.started_on||step.completed_on||step.note).length;return <tr key={item.id}><td>{item.case_number}</td><td>{item.worker_name}</td><td>{completed}/{steps.length} 項已更新</td><td>{({open:'進行中',on_hold:'暫停',closed:'結案'})[item.status]||item.status}</td><td><button className="table-action" onClick={()=>{const worker=data.workers.find(row=>Number(row.id)===Number(item.worker_id));if(worker)setProgressWorker(worker)}}>查看工作者進度</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'employer' && !progressWorker && data.workers.some(item=>!item.sharedAgencyCaseOnly) && <section className="hr-member-card"><h2>我的工作者與未媒合人選</h2><div className="hr-member-table-wrap"><table><thead><tr><th>姓名</th><th>國籍</th><th>工作意向</th><th>所屬仲介</th><th>狀態</th><th>進度</th><th>履歷</th></tr></thead><tbody>{data.workers.filter(item=>!item.sharedAgencyCaseOnly).map(item=>{const agency=data.agencies.find(row=>Number(row.id)===Number(item.agency_id));const hasCase=data.cases.some(row=>Number(row.worker_id)===Number(item.id));return <tr key={item.id}><td>{item.name}</td><td>{item.nationality||'—'}</td><td>{item.job_preference||'—'}</td><td>{agency?.name||'—'}</td><td>{item.status==='active'?'啟用':'停用'}</td><td>{hasCase?<button className="table-action" onClick={()=>setProgressWorker(item)}>查看進度</button>:'尚未媒合'}</td><td><button className="table-action" onClick={()=>setProfileWorker(item)}>查看履歷</button><button className="table-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(item)}>下載 PDF</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='documents'&&<section className="hr-member-card"><h2>必要文件與審核</h2>{workerCases.length?workerCases.map(caseItem=><div className="worker-case" key={caseItem.id}><h3>{caseItem.case_number} · {caseItem.employer_name}</h3>{workerRequirements.filter(item=>Number(item.case_id)===Number(caseItem.id)).map(item=>{const history=data.submissions.filter(sub=>Number(sub.requirement_id)===Number(item.id));return <div className="document-item" key={item.id}><div className="document-heading"><div><strong>{item.name}</strong>{item.applicability&&<small>{item.applicability}</small>}</div><span className={`doc-status doc-${item.applicable?item.status:'na'}`}>{!item.applicable?'不適用':({missing:'待收件',submitted:'待審核',approved:'已合格',returned:'退件待修正'}[item.status]||item.status)}</span></div>{item.review_reason&&item.applicable&&item.status==='returned'&&<p className="return-note">補件原因：{item.review_reason}</p>}{history.length>0&&<div className="document-history">{history.map(sub=><div key={sub.id}><span>第{sub.version_number}版 · {sub.original_filename}</span><span>{sub.decision==='approved'?'合格':sub.decision==='returned'?`退件：${sub.review_reason||''}`:'審核中'}</span><a href={`/api/hr/documents/${sub.id}?preview=1`} target="_blank" rel="noreferrer">檢視</a></div>)}</div>}{item.applicable&&(data.role==='worker'||isPhilippinesOperator)&&<form className="upload-row" onSubmit={event=>uploadDocument(event,item)}><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required/><input name="note" placeholder="補件說明（選填）"/><button disabled={uploading}>{uploading?'上傳中…':item.status==='returned'?'重新上傳':'上傳文件'}</button></form>}{isPhilippinesOperator&&<div className="document-actions">{item.applicability&&<button className="table-action" onClick={()=>setApplicability(item)}>{item.applicable?'標示不適用':'確認適用'}</button>}{item.status==='submitted'&&<><button className="table-action" onClick={()=>reviewDocument(item,'approved')}>核准文件</button><button className="table-action" onClick={()=>reviewDocument(item,'returned')}>退回補件</button></>}</div>}</div>})}</div>):<p>目前沒有必要文件項目。</p>}</section>}
    {activeWorkspaceTab==='process'&&<section className="hr-member-card"><h2>赴台申請程序</h2>{workerCases.length?workerCases.map(caseItem=><div className="worker-case" key={caseItem.id}><h3>{caseItem.case_number} · {caseItem.employer_name}</h3>{data.applicationSteps.filter(step=>Number(step.case_id)===Number(caseItem.id)).map(step=>{const singleDate=['match_date','passport','document_arrival','personal_documents','pdos','medical','accr_in','accr_out','umid','expected_entry','actual_entry'].includes(step.step_key);const canEdit=canManageCaseProgress;return <form className="process-row" key={step.id} onSubmit={event=>saveApplicationStep(event,step)}><strong>{step.label}</strong>{singleDate?<label>{step.step_key==='expected_entry'?'預定入境日期':step.step_key==='actual_entry'?'實際入境日期':step.step_key==='match_date'?'配工／面試日期':step.step_key==='passport'?'護照確認日期':step.step_key==='document_arrival'?'文件到達日期':step.step_key==='personal_documents'?'個人文件確認日期':step.step_key==='pdos'?'PDOS 日期':step.step_key==='medical'?'體檢日期':step.step_key==='accr_in'?'入件日期':step.step_key==='accr_out'?'出件日期':'辦理日期'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label>:<><label>{step.step_key==='training'?'訓練開始日':'辦件／開始日'}<input type="date" name="startedOn" defaultValue={step.started_on?String(step.started_on).slice(0,10):''} disabled={!canEdit}/></label><label>{step.step_key==='training'?'訓練完成日':'完成／出件日'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label></>}<input name="note" placeholder="狀態／備註" defaultValue={step.note||''} disabled={!canEdit}/>{canEdit&&<button disabled={stepSaving===`${step.case_id}:${step.step_key}`}>{stepSaving===`${step.case_id}:${step.step_key}`?'儲存中…':'儲存'}</button>}</form>})}</div>):<p>目前沒有來台申請程序。</p>}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role==='worker'&&!!data.employers.length && <section className="hr-member-card"><h2>我的雇主</h2><div className="hr-member-table-wrap"><table><thead><tr><th>雇主／客戶</th><th>類型</th><th>聯絡人</th><th>狀態</th></tr></thead><tbody>{data.employers.map(item => <tr key={item.id}><td>{item.name}</td><td>{{home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'}[item.employer_type] || '其他'}</td><td>{item.contact_name || '—'}</td><td>{item.status === 'active' ? '啟用' : '停用'}</td></tr>)}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&!!data.agencies.length && data.role === 'worker' && <section className="hr-member-card"><h2>所屬仲介</h2><ul>{data.agencies.map(item => <li key={item.id}>{item.name}（{item.country || (item.agency_type === 'taiwan' ? '台灣' : '菲律賓')}）</li>)}</ul></section>}
    {profileWorker && <div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setProfileWorker(null)}}><section className="progress-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title"><header className="progress-modal-header"><div><span>工作者資料</span><h2 id="profile-modal-title">{profileWorker.name}</h2></div><div className="profile-modal-actions"><button type="button" className="profile-edit-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(profileWorker)}>{resumePdfLoading?'產生中…':'下載履歷 PDF'}</button>{isPhilippinesOperator&&Number(profileWorker.agency_id)===Number(data.agencyId)&&<button type="button" className="profile-edit-action" onClick={()=>{setProfileWorker(null);beginWorkerEdit(profileWorker)}}>編輯資料</button>}<button type="button" className="progress-modal-close" aria-label="關閉工作者資料" onClick={()=>setProfileWorker(null)}>×</button></div></header><div className="progress-modal-body"><div className="worker-detail"><p>姓名：{profileWorker.name}</p><p>國籍：{profileWorker.nationality||'—'}</p><p>電話：{profileWorker.phone||'—'}</p><p>Email：{profileWorker.email||'—'}</p><p>工作意向：{profileWorker.job_preference||'—'}</p><p>狀態：{profileWorker.status==='active'?'啟用':'停用'}</p></div>{resumeViewPhoto&&<img className="resume-profile-photo" src={resumeViewPhoto} alt="履歷照片"/>}<WorkerResumeSections profile={profileWorker.resume_profile}/>{profileWorker.notes&&<div className="profile-notes"><strong>備註</strong><p>{profileWorker.notes}</p></div>}</div></section></div>}
    {progressWorker && <div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setProgressWorker(null)}}><section className="progress-modal" role="dialog" aria-modal="true" aria-labelledby="progress-modal-title"><header className="progress-modal-header"><div><span>案件進度</span><h2 id="progress-modal-title">{progressWorker.name}</h2></div><button type="button" className="progress-modal-close" aria-label="關閉進度視窗" onClick={()=>setProgressWorker(null)}>×</button></header><div className="progress-modal-body"><div className="worker-detail"><p>國籍：{progressWorker.nationality||'—'}</p><p>工作意向：{progressWorker.job_preference||'—'}</p><p>所屬仲介：{data.agencies.find(row=>Number(row.id)===Number(progressWorker.agency_id))?.name||'—'}</p></div>{data.cases.filter(item=>Number(item.worker_id)===Number(progressWorker.id)).map(caseItem=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(caseItem.id));const requirements=data.requirements.filter(item=>Number(item.case_id)===Number(caseItem.id));return <article className="progress-modal-case" key={caseItem.id}><h3>{caseItem.case_number} · {caseItem.employer_name||'雇主未指定'}</h3><h4>必要文件</h4>{requirements.length?<ul className="progress-document-list">{requirements.map(item=><li key={item.id}><span>{item.name}</span><strong className={`doc-status doc-${item.applicable?item.status:'na'}`}>{!item.applicable?'不適用':({missing:'待收件',submitted:'待審核',approved:'已合格',returned:'退件待修正'}[item.status]||item.status)}</strong></li>)}</ul>:<p>此案件尚無必要文件資料。</p>}<h4>赴台申請程序</h4>{steps.map(step=>{const canEdit=data.role==='agency';const singleDate=['match_date','passport','document_arrival','personal_documents','pdos','medical','accr_in','accr_out','umid','expected_entry','actual_entry'].includes(step.step_key);return <form className="progress-step" key={step.id} onSubmit={event=>saveApplicationStep(event,step)}><strong>{step.label}</strong>{singleDate?<label>{step.step_key==='expected_entry'?'預定入境日期':step.step_key==='actual_entry'?'實際入境日期':step.step_key==='match_date'?'配工／面試日期':'辦理日期'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label>:<><label>開始日<input type="date" name="startedOn" defaultValue={step.started_on?String(step.started_on).slice(0,10):''} disabled={!canEdit}/></label><label>完成日<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label></>}<input name="note" placeholder="狀態／備註" defaultValue={step.note||''} disabled={!canEdit}/>{canEdit&&<button disabled={stepSaving===`${step.case_id}:${step.step_key}`}>{stepSaving===`${step.case_id}:${step.step_key}`?'儲存中…':'儲存'}</button>}</form>})}</article>})}{data.cases.every(item=>Number(item.worker_id)!==Number(progressWorker.id))&&<p>此工作者目前沒有申辦案件。</p>}</div></section></div>}
    <section className="workspace-chat-page" hidden={activeWorkspaceTab!=='chat'}><HrChat /></section>
    <footer className="hr-member-footer">資料僅供授權帳號查閱。</footer>
    <style jsx>{`
      .hr-member-shell{min-height:100vh;background:#f4f7f5;color:#1b2b26;padding:clamp(20px,5vw,56px);font-family:Arial,sans-serif}
      .hr-member-header{max-width:1100px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:center;gap:20px}
      .hr-member-header span,.hr-member-card h2{color:#176b54;font-weight:700}.hr-member-header h1{margin:8px 0;font-size:30px}.hr-member-header p,.hr-member-card p{color:#60716a}
      .hr-member-header button,.hr-member-card button{border:0;border-radius:9px;background:#176b54;color:white;padding:11px 16px;font-weight:700;cursor:pointer}
      .hr-member-pending{max-width:600px;margin:30px auto}.hr-member-pending h2{margin:0 0 12px;color:#176b54}.hr-member-pending p{line-height:1.7}.hr-member-pending form{display:grid;gap:16px;margin-top:20px}.hr-member-pending label{display:grid;gap:8px;color:#43584f;font-weight:700}.hr-member-pending select{min-height:44px;padding:8px 12px;border:1px solid #ccd9d2;border-radius:9px;background:#fff;font:inherit}.hr-member-pending form button{min-height:44px}.hr-request-error{color:#b42318!important}
      .hr-member-summary,.hr-member-card,.hr-member-footer{max-width:1100px;margin:0 auto 16px}
      .workspace-tabs{position:sticky;top:8px;z-index:20;display:flex;gap:8px;max-width:1100px;margin:0 auto 18px;padding:8px;overflow-x:auto;border:1px solid #dce6e1;border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 6px 20px rgba(24,54,41,.08);scrollbar-width:thin}.workspace-tabs button{flex:1 0 auto;min-height:42px;padding:9px 15px;border:1px solid transparent;border-radius:9px;background:transparent;color:#52655c;font:inherit;font-weight:700;white-space:nowrap;cursor:pointer}.workspace-tabs button:hover{background:#f2f7f4}.workspace-tabs button.active{background:#176b54;color:#fff}.workspace-basic-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0}.workspace-basic-fields>div{min-width:0;padding:12px;border-radius:9px;background:#f6f9f7}.workspace-basic-fields dt{color:#728178;font-size:12px;font-weight:700}.workspace-basic-fields dd{margin:5px 0 0;overflow-wrap:anywhere;color:#263d33;font-weight:600}.workspace-chat-page[hidden]{display:none}
      .hr-member-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.hr-member-summary article,.hr-member-card{background:white;border:1px solid #dce6e1;border-radius:14px;padding:20px}.hr-member-summary small{display:block;color:#60716a}.hr-member-summary strong{display:block;font-size:27px;margin-top:8px}
      .hr-member-card h2{font-size:18px;margin:0 0 14px}.hr-member-table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px 10px;border-bottom:1px solid #e8eeeb;white-space:nowrap}th{font-size:12px;color:#60716a}td{font-size:14px}li{margin:8px 0;color:#43584f}.hr-member-footer{color:#75847d;font-size:12px;padding:8px 2px}.hr-member-shell>section:first-child{max-width:560px;margin:10vh auto;background:white;border:1px solid #dce6e1;border-radius:16px;padding:30px}
      .card-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.card-title h2{margin:0}.card-title button,.worker-form button,.upload-row button,.agency-choice button{border:0;border-radius:8px;background:#176b54;color:#fff;padding:9px 13px;font-weight:700;cursor:pointer}.card-title .light-action{background:#edf3f0;color:#42554c;margin-right:7px}.worker-link{border:0;background:none;padding:0;color:#176b54;font:inherit;font-weight:700;cursor:pointer}.table-action{border:0;background:#edf3f0;color:#40554b;border-radius:6px;margin-right:5px;padding:7px 9px;cursor:pointer}.worker-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.worker-form label{display:grid;gap:6px;color:#53665d;font-size:12px;font-weight:700}.worker-form input,.worker-form select,.worker-form textarea,.agency-choice select,.upload-row input[type=file],.case-status{min-width:0;padding:10px;border:1px solid #dce6e1;border-radius:8px;font:inherit;background:white}.worker-form .form-wide{grid-column:1/-1}.worker-form button{justify-self:start}.agency-choice{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.agency-choice label{display:grid;gap:6px;min-width:min(100%,320px);color:#53665d;font-size:12px;font-weight:700}.worker-detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.upload-row{display:grid;grid-template-columns:minmax(140px,1fr) minmax(180px,1fr) auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #e8eeeb}.upload-row strong,.upload-row small{display:block}.upload-row small{margin-top:4px;color:#76847d;font-size:12px}.hr-request-error{max-width:1100px;margin:0 auto 12px;color:#b42318}
      .orders-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.orders-heading h2{margin:3px 0 6px}.orders-heading p{margin:0;line-height:1.6}.orders-eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;color:#81928a}.orders-count{flex:none;border-radius:999px;background:#e8f3ed;color:#176b54;padding:8px 12px;font-size:12px;font-weight:800}.order-form{padding:18px;border:1px solid #e1ebe5;border-radius:13px;background:#f8faf9}.order-form legend{padding:0 5px;color:#43584f;font-size:12px;font-weight:800}.order-form fieldset{display:flex;flex-wrap:wrap;gap:10px 18px;padding:12px;border:1px solid #dce6e1;border-radius:10px}.order-form fieldset label{display:flex;align-items:center;gap:7px;font-size:13px}.order-form fieldset input[type=checkbox]{accent-color:#176b54;width:17px;height:17px}.order-form textarea{resize:vertical}.order-form>button{min-height:43px;padding:10px 18px;box-shadow:0 4px 10px #176b5426}.orders-section{margin-top:28px}.orders-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}.orders-section-heading h3{margin:0;font-size:17px;color:#263d33}.orders-section-heading>span{color:#75847d;font-size:12px}.job-order-card{overflow:hidden;margin:0 0 14px;border:1px solid #dce6e1;border-radius:14px;background:#fff;box-shadow:0 4px 14px #263d3308}.job-order-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;background:linear-gradient(110deg,#eff7f2,#f8faf9);border-bottom:1px solid #e4ece7}.job-order-number{font-size:11px;font-weight:800;letter-spacing:.04em;color:#71837a}.job-order-header h4{margin:4px 0 0;color:#193c30;font-size:17px}.order-status{flex:none;border-radius:999px;padding:6px 11px;background:#e7f3ec;color:#176b54;font-size:11px;font-weight:800}.order-status.status-filled{background:#edf0ee;color:#56645d}.order-status.status-cancelled{background:#fcebea;color:#b42318}.job-order-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px 18px;border-bottom:1px solid #edf1ee}.job-order-facts>div{display:grid;gap:3px}.job-order-facts small{color:#7a8982;font-size:10px}.job-order-facts strong{color:#33483e;font-size:13px}.job-order-description{margin:0;padding:12px 18px;color:#53665d!important;line-height:1.6;border-bottom:1px solid #edf1ee;white-space:pre-wrap}.order-agency-list{display:grid;gap:10px;padding:12px}.order-agency-card{padding:12px 14px;border:1px solid #e7ede9;border-radius:10px;background:#fcfdfc}.order-agency-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.order-agency-heading>div{display:grid;gap:3px}.order-agency-heading small,.candidate-card small{color:#7a8982;font-size:10px}.order-agency-heading strong{font-size:13px;color:#263d33}.order-agency-heading>span{color:#52665b;font-size:11px;text-align:right}.order-routing{margin:8px 0 0;font-size:12px;line-height:1.5}.candidate-list{display:grid;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid #e8eeeb}.candidate-list h5{margin:0;color:#5d7167;font-size:11px}.candidate-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border-radius:8px;background:#f5f8f6}.candidate-card>div:first-child{display:grid;gap:3px}.candidate-card strong{font-size:12px;color:#243a30}.candidate-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.candidate-actions button{border:1px solid #d6e5dc;border-radius:6px;background:#fff;color:#176b54;padding:6px 8px;font-size:10px;font-weight:700;cursor:pointer}.candidate-actions .candidate-reject{color:#9c3e39;border-color:#eed6d4}.order-awaiting{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 12px;border-radius:8px;background:#f5f8f6}.order-awaiting>span,.orders-empty>span{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:#e4f0e8;color:#176b54;font-weight:800}.order-awaiting>div{display:grid;gap:3px}.order-awaiting strong{font-size:12px;color:#40554b}.order-awaiting small{font-size:11px;color:#7a8982}.orders-empty{display:grid;justify-items:center;gap:8px;padding:28px 16px;border:1px dashed #cbd9d1;border-radius:12px;background:#fafcfb;text-align:center}.orders-empty>span{width:38px;height:38px;font-size:22px}.orders-empty strong{color:#344b40}.orders-empty p{margin:0;font-size:12px;line-height:1.6}
      .employer-agency-card{display:flex;align-items:center;justify-content:space-between;gap:16px}.employer-agency-card h2{margin:0 0 4px}.employer-agency-card p{margin:0;font-size:12px}.employer-agency-select{display:grid;gap:6px;min-width:min(100%,320px);color:#53665d;font-size:12px;font-weight:700}.employer-agency-select select{min-width:0;padding:10px;border:1px solid #dce6e1;border-radius:8px;background:#fff;font:inherit}.employer-agency-select small{color:#728279;font-weight:500}
      :global(.resume-profile-header){display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px}:global(.resume-profile-header h2){margin:3px 0 6px}:global(.resume-profile-header p){margin:0;line-height:1.6}:global(.resume-profile-header button){flex:none}:global(.resume-contact){padding:12px 14px;margin-bottom:16px;border-radius:10px;background:#f6f9f7}:global(.worker-resume-sections){display:grid;gap:12px}:global(.worker-resume-section){padding:14px 0;border-top:1px solid #e8eeeb}:global(.worker-resume-section h3){margin:0 0 10px;color:#176b54;font-size:14px}:global(.resume-fields){display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px;margin:0}:global(.resume-fields>div){min-width:0}:global(.resume-fields dt){color:#76847d;font-size:11px;font-weight:700}:global(.resume-fields dd){margin:4px 0 0;color:#263d33;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}:global(.resume-fields .resume-value-wide){grid-column:1/-1}:global(.resume-empty){margin:8px 0;padding:14px;border:1px dashed #d4e0d8;border-radius:9px;background:#fafcfb;font-size:12px}:global(.resume-form-section){min-width:0;margin:0;padding:14px;border:1px solid #e1e9e4;border-radius:10px;background:#fbfcfb}:global(.resume-form-section h3){margin:0 0 12px;color:#176b54;font-size:14px}:global(.resume-form-section legend){padding:0 5px;color:#176b54;font-size:14px;font-weight:800}:global(.resume-form-grid){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}:global(.resume-form-grid label){display:grid;align-content:start;gap:6px;min-width:0;color:#53665d;font-size:12px;font-weight:700}:global(.resume-form-grid input),:global(.resume-form-grid textarea){box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid #dce6e1;border-radius:8px;background:#fff;font:inherit;font-weight:400;color:#263d33}:global(.resume-form-grid textarea){resize:vertical;line-height:1.5}:global(.resume-form-grid .resume-field-wide){grid-column:1/-1}:global(.resume-choice-field){grid-column:1/-1;min-width:0;margin:0;padding:10px;border:1px solid #e1e9e4;border-radius:9px}:global(.resume-choice-field legend){padding:0 5px;color:#53665d;font-size:12px;font-weight:700}:global(.resume-choice-list){display:flex;flex-wrap:wrap;gap:8px}:global(.resume-choice-item){display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:7px!important;padding:8px 10px;border:1px solid #dce6e1;border-radius:999px;background:#fff}:global(.resume-choice-item input){width:16px!important;height:16px;margin:0;accent-color:#176b54}:global(.resume-choice-item span){font-weight:600}
      :global(.resume-profile-header>div:last-child){display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}:global(.resume-photo-field img){display:block;width:72px;height:90px;object-fit:cover;border:1px solid #dce6e1;border-radius:8px}:global(.resume-import-box){display:grid;gap:7px;margin:0 0 14px;padding:12px;border:1px dashed #b9d4c7;border-radius:9px;background:#f2f8f4}:global(.resume-import-box label){display:grid;gap:7px;color:#176b54;font-weight:800}:global(.resume-import-box input){max-width:100%;font:inherit}:global(.resume-import-box small){color:#66776e;line-height:1.5}:global(.resume-import-box p){margin:0;color:#176b54;font-size:12px;line-height:1.5}:global(.profile-modal-actions){flex-wrap:wrap}:global(.profile-modal-actions .profile-edit-action){white-space:nowrap}
      .worker-case{padding:12px 0}.worker-case+ .worker-case{border-top:1px solid #e8eeeb}.worker-case h3{margin:2px 0 12px;font-size:14px;color:#42554c}.document-item{padding:12px 0;border-top:1px solid #edf1ee}.document-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.document-heading strong,.document-heading small{display:block}.document-heading small{margin-top:4px;color:#7d8983;font-size:12px}.doc-status{font-size:12px;font-weight:700;color:#85661c}.doc-approved{color:#14744e}.doc-returned{color:#b42318}.doc-na{color:#8b9690}.return-note{margin:8px 0;color:#b42318!important;font-size:12px}.document-history{display:grid;gap:5px;margin:9px 0}.document-history>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:7px 9px;background:#f7f9f7;border-radius:7px;font-size:12px;color:#617168}.document-history>div span:first-child{margin-right:auto}.document-history a{color:#176b54;font-weight:700}.upload-row{grid-template-columns:minmax(170px,1fr) minmax(150px,1fr) auto}.upload-row input:not([type=file]),.process-row input{min-width:0;padding:9px;border:1px solid #dce6e1;border-radius:8px;font:inherit}.document-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.process-row{display:grid;grid-template-columns:minmax(140px,1.2fr) repeat(2,minmax(130px,1fr)) minmax(120px,1fr) auto;align-items:end;gap:9px;padding:10px 0;border-top:1px solid #edf1ee}.process-row strong{align-self:center;font-size:13px}.process-row label{display:grid;gap:5px;color:#68786f;font-size:11px}.process-row input{width:100%}.process-row button{border:0;border-radius:7px;background:#176b54;color:#fff;padding:9px 11px;font-weight:700;cursor:pointer}
      .progress-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(14,28,23,.58);backdrop-filter:blur(3px)}.progress-modal{display:flex;flex-direction:column;width:min(900px,100%);max-height:min(88vh,900px);overflow:hidden;background:#fff;border:1px solid #dce6e1;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.24)}.progress-modal-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid #e8eeeb}.progress-modal-header span{font-size:12px;font-weight:800;letter-spacing:.08em;color:#608075}.progress-modal-header h2{margin:4px 0 0;color:#176b54}.progress-modal-close{flex:none;width:42px;height:42px;border:0;border-radius:50%;background:#edf3f0!important;color:#42554c!important;font-size:28px;line-height:1;cursor:pointer}.progress-modal-body{overflow:auto;padding:20px 24px}.delete-worker-error{margin:0 0 14px;color:#b42318!important;font-weight:700}.worker-edit-form{padding:22px 24px;overflow:auto}.worker-edit-actions,.profile-modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;grid-column:1/-1}.worker-edit-actions .worker-edit-cancel,.profile-edit-action{border:0;border-radius:8px;background:#edf3f0;color:#42554c;padding:10px 15px;font-weight:700;cursor:pointer}.worker-delete-confirm{border:0;border-radius:8px;background:#b42318!important;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}.worker-edit-actions button:disabled{opacity:.6;cursor:wait}.progress-modal-case{margin-top:18px;padding-top:14px;border-top:1px solid #e8eeeb}.progress-modal-case h3{margin:0 0 14px;color:#263d33}.progress-modal-case h4{margin:18px 0 8px;color:#176b54}.progress-document-list{display:grid;gap:8px;padding:0;margin:0;list-style:none}.progress-document-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;margin:0;border-radius:8px;background:#f6f8f6}.progress-step{display:grid;grid-template-columns:minmax(140px,1fr) repeat(2,minmax(120px,1fr)) minmax(120px,1fr) auto;align-items:end;gap:9px;padding:10px 0;border-top:1px solid #edf1ee}.progress-step strong{align-self:center;font-size:13px}.progress-step label{display:grid;gap:5px;color:#68786f;font-size:11px}.progress-step input{min-width:0;width:100%;padding:9px;border:1px solid #dce6e1;border-radius:8px;font:inherit}.progress-step button{border:0;border-radius:7px;background:#176b54;color:#fff;padding:9px 11px;font-weight:700;cursor:pointer}.profile-notes{margin-top:16px;padding:12px 14px;border-radius:9px;background:#f6f8f6}.profile-notes strong{color:#176b54}.profile-notes p{margin:6px 0 0;white-space:pre-wrap}
      :global(.resume-language-field){display:grid;gap:10px}:global(.resume-language-level){display:grid!important;grid-template-columns:minmax(100px,1fr) minmax(140px,220px);align-items:center;gap:10px!important;color:#53665d;font-weight:700}:global(.resume-language-level select){box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid #dce6e1;border-radius:8px;background:#fff;font:inherit;color:#263d33}:global(.resume-radio-field){grid-column:1/-1;min-width:0;margin:0;padding:10px;border:1px solid #e1e9e4;border-radius:9px}:global(.resume-radio-field legend){padding:0 5px;color:#53665d;font-size:12px;font-weight:700}:global(.resume-radio-field>div){display:flex;flex-wrap:wrap;gap:10px}:global(.resume-radio-field>div label){display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px!important;padding:8px 14px;border:1px solid #dce6e1;border-radius:999px;background:#fff}:global(.resume-radio-field input[type=radio]){width:18px!important;height:18px;margin:0;accent-color:#176b54}
      :global(.resume-profile-photo){display:block;width:112px;height:144px;margin:0 0 14px;object-fit:cover;border:1px solid #dce6e1;border-radius:10px;background:#f6f9f7}
      :global(.resume-experience-editor){display:grid;gap:12px}:global(.resume-experience-editor>h4){margin:0;color:#53665d;font-size:14px}:global(.resume-experience-row){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0;margin:0;padding:14px;border:1px solid #dce6e1;border-radius:10px;background:#fbfdfc}:global(.resume-experience-row legend){padding:0 6px;color:#176b54;font-size:13px;font-weight:800}:global(.resume-experience-row label){display:grid;gap:5px;min-width:0;color:#53665d;font-size:12px;font-weight:700}:global(.resume-experience-row input),:global(.resume-experience-row textarea){box-sizing:border-box;width:100%;min-width:0;padding:10px;border:1px solid #dce6e1;border-radius:8px;background:#fff;color:#263d33;font:inherit}:global(.resume-experience-row .resume-field-wide){grid-column:1/-1}:global(.resume-experience-remove){justify-self:start;border:0;background:transparent;color:#a33d32;font:inherit;font-size:12px;font-weight:700;cursor:pointer}:global(.resume-experience-add){justify-self:start;border:1px solid #176b54;border-radius:8px;background:#fff;color:#176b54;padding:9px 13px;font:inherit;font-weight:700;cursor:pointer}:global(.resume-experience-view){display:grid;gap:4px;padding:10px 12px;border-bottom:1px solid #e8eeeb}:global(.resume-experience-view:first-child){padding-top:0}:global(.resume-experience-view p){margin:2px 0 0;white-space:pre-wrap}
      @media(max-width:700px){.hr-member-header{align-items:flex-start}.hr-member-header h1{font-size:24px}.hr-member-card{padding:15px}.workspace-tabs{top:4px;margin-bottom:14px;padding:6px}.workspace-tabs button{min-height:40px;padding:8px 12px}.workspace-basic-fields{grid-template-columns:1fr}.worker-form,.worker-detail,.upload-row,.process-row,.progress-step{grid-template-columns:1fr}.card-title{align-items:flex-start}.document-heading{align-items:flex-start}.process-row strong,.progress-step strong{padding-top:8px}.progress-modal-backdrop{padding:0;align-items:end}.progress-modal{width:100%;max-height:92vh;border-radius:18px 18px 0 0}.progress-modal-header,.progress-modal-body{padding-left:18px;padding-right:18px}.orders-heading{align-items:flex-start}.orders-count{font-size:10px}.order-form{padding:13px}.job-order-facts{gap:4px;padding:11px 13px}.job-order-facts strong{font-size:12px}.job-order-header{padding:14px}.order-agency-heading{align-items:flex-start;flex-direction:column;gap:5px}.order-agency-heading>span{text-align:left}.candidate-card{align-items:flex-start;flex-direction:column}.candidate-actions{justify-content:flex-start}.employer-agency-card{align-items:stretch;flex-direction:column}.employer-agency-select{min-width:0}.orders-section{margin-top:22px}:global(.resume-profile-header){align-items:flex-start}:global(.resume-profile-header button){padding:9px 11px!important}:global(.resume-fields){grid-template-columns:repeat(2,minmax(0,1fr))}:global(.resume-form-grid){grid-template-columns:1fr}:global(.resume-form-grid .resume-field-wide){grid-column:auto}:global(.resume-experience-row){grid-template-columns:1fr}:global(.resume-experience-row .resume-field-wide){grid-column:auto}}
    `}</style>
  </main>;
}

