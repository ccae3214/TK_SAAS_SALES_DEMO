"use client";

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, UserRound, Building2, FileText, Route, MessagesSquare, LogOut, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { HrLanguageTools, translateHrText } from '@/lib/hr-translations';
import HrFilePicker from '@/components/HrFilePicker';
import HrWorkerProgressLink from '@/components/HrWorkerProgressLink';
import HrPhotoCropper from '@/components/HrPhotoCropper';
import HrChat from '@/components/HrChat';
import HrReminders from '@/components/HrReminders';
import HrDocumentReviewList from '@/components/HrDocumentReviewList';
import PersonNameFields from '@/components/PersonNameFields';
import { OrderJourney, WorkspaceStart } from '@/components/HrJourney';
import { orderJourney } from '@/lib/hr-workflow';
import { useHrDialog } from '@/lib/use-hr-dialog';
import { WORKER_STAGES, DOCUMENT_GUIDE, STAGE_NOTICE, STAGE_HELP, stageOfRequirement, stageOfStep } from '@/lib/hr-worker-stages';
import { WORKER_RESUME_YES_NO, parseResumePdf } from '@/lib/hr-resume-import';
import { WORKER_RESUME_CHOICES, WORKER_RESUME_LANGUAGES, WORKER_RESUME_SELECTS, readLanguageLevels, resumeChoiceList } from '@/lib/hr-resume-fields';

const labels = { worker: '工作者', employer: '雇主', agency: '仲介' };
const EMPTY_WORKER_RESUME = {
  photoDataUrl:'',referenceNo:'',birthDate:'',gender:'',birthplace:'',address:'',height:'',weight:'',skinComplexion:'',maritalStatus:'',religion:'',hobby:'',
  spouseName:'',spouseOccupation:'',spouseAge:'',numberOfChildren:'',childrenAges:'',fatherName:'',fatherOccupation:'',fatherBirthDate:'',motherName:'',motherOccupation:'',motherBirthDate:'',brotherCount:'',brotherAges:'',sisterCount:'',sisterAges:'',familyRank:'',caregiverDuringOverseas:'',
  educationLevels:'',education:'',coursesCompleted:'',languageOptions:'',languages:'',cookingSkills:'',applianceOptions:'',applianceSkills:'',childcareSkills:'',experienceNewborn:'',experienceChildren:'',experienceElderly:'',experienceDisabled:'',
  hasTattoo:'',smokes:'',drinksAlcohol:'',petExperience:'',willingToWorkWithPets:'',seriousIllness:'',operationLast12Months:'',allergies:'',dayOffChores:'',finishChoresBeforeOuting:'',returnBy8PM:'',makeupAtWork:'',workOnDaysOff:'',workedAbroad:'',overseasWorkDetails:'',employmentHistory:'',overseasExperiences:[],employmentExperiences:[],remarks:'',
};
const WORKER_RESUME_GROUPS = [
  { title:'基本資料', fields:[['referenceNo','履歷編號'],['birthDate','出生日期'],['gender','性別'],['birthplace','出生地'],['address','地址'],['height','身高（cm）'],['weight','體重（kg）'],['skinComplexion','膚色'],['maritalStatus','婚姻狀況'],['religion','宗教'],['hobby','興趣']] },
  { title:'家庭資料', fields:[['spouseName','配偶姓名'],['spouseOccupation','配偶職業'],['spouseAge','配偶年齡'],['numberOfChildren','子女人數'],['childrenAges','子女年齡'],['fatherName','父親姓名'],['fatherOccupation','父親職業'],['fatherBirthDate','父親出生日期'],['motherName','母親姓名'],['motherOccupation','母親職業'],['motherBirthDate','母親出生日期'],['brotherCount','兄弟人數'],['brotherAges','兄弟年齡'],['sisterCount','姊妹人數'],['sisterAges','姊妹年齡'],['familyRank','家中排行'],['caregiverDuringOverseas','出國工作期間子女照顧者']] },
  { title:'教育與語言', fields:[['educationLevels','教育程度'],['coursesCompleted','完成課程'],['languages','語言能力']] },
  { title:'技能與照護經驗', fields:[['cookingSkills','烹飪技能'],['applianceOptions','家電操作'],['childcareSkills','嬰幼兒照護技能'],['experienceNewborn','新生兒照護經驗'],['experienceChildren','兒童照護經驗'],['experienceElderly','長者照護經驗'],['experienceDisabled','身心障礙者照護經驗']] },
  { title:'個人資料問答', fields:[['hasTattoo','是否有刺青'],['smokes','是否吸菸'],['drinksAlcohol','是否飲酒'],['petExperience','寵物照護經驗與種類'],['willingToWorkWithPets','是否願意在有寵物的家庭工作'],['seriousIllness','是否曾有重大疾病'],['operationLast12Months','過去 12 個月是否接受手術'],['allergies','是否有過敏'],['dayOffChores','休假日是否願意完成家務'],['finishChoresBeforeOuting','外出前是否完成家務'],['returnBy8PM','休假日是否可於晚上 8 點前返家'],['makeupAtWork','工作時是否化妝'],['workOnDaysOff','是否願意於休假日加班'],['workedAbroad','是否曾在海外工作']] },
  { title:'海外工作經歷', fields:[['overseasExperiences','海外工作地點與期間']] },
  { title:'國內工作經歷', fields:[['employmentExperiences','工作經歷']] },
  { title:'備註', fields:[['remarks','其他說明']] },
];
const WORKER_RESUME_TEXTAREAS = new Set(['address','education','coursesCompleted','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','petExperience','overseasWorkDetails','employmentHistory','remarks']);
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
function ResumeFieldEditor({ field,label,workerForm,updateWorkerResume }) {
  const { lang } = useLanguage();
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
  return <label className={WORKER_RESUME_TEXTAREAS.has(field)?'resume-field-wide':''}>{label}{WORKER_RESUME_TEXTAREAS.has(field)?<textarea placeholder={field==='employmentHistory'?'每段經歷請填：雇主｜職務｜地址／電話｜期間｜服務人數／年齡｜離職原因｜工作內容':''} rows={field==='employmentHistory'?6:3} value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}/>:<input lang={['birthDate','fatherBirthDate','motherBirthDate'].includes(field)?lang:undefined} type={['birthDate','fatherBirthDate','motherBirthDate'].includes(field)?'date':'text'} value={workerForm.resumeProfile[field]||''} onChange={event=>updateWorkerResume(field,event.target.value)}/>}</label>;
}
function WorkerResumeSections({ profile }) {
  const resume = profile && typeof profile === 'object' ? profile : {};
  const groups = WORKER_RESUME_GROUPS.map(group=>({...group,fields:group.fields.filter(([field])=>resumeFieldText(resume,field))})).filter(group=>group.fields.length);
  if (!groups.length) return <p className="resume-empty">尚未填寫履歷資料。</p>;
  return <div className="worker-resume-sections">{groups.map(group=><section className="worker-resume-section" key={group.title}><h3>{group.title}</h3><dl className="resume-fields">{group.fields.map(([field,label])=><div className={['education','languages','hobby','address','cookingSkills','applianceOptions','childcareSkills','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','employmentExperiences','overseasExperiences'].includes(field)?'resume-value-wide':''} key={field}><dt>{label}</dt><dd>{field==='languages'?formatLanguageLevels(resume.languageOptions,resume.languages):field==='overseasExperiences'||field==='employmentExperiences'?normalizeExperienceRows(resume,field,field==='overseasExperiences'?'overseasWorkDetails':'employmentHistory').filter(row=>row.workplace||row.period||row.title||row.content).map((row,index)=><div className="resume-experience-view" key={`${field}-view-${index}`}><strong>{index+1}. {row.workplace}</strong>{row.period&&<span>{row.period}</span>}{row.title&&<span>{row.title}</span>}{row.content&&<p>{row.content}</p>}</div>):resume[field]}</dd></div>)}</dl></section>)}</div>;
}
const RESUME_LONG_FIELDS = new Set(['address','education','coursesCompleted','languages','cookingSkills','applianceSkills','childcareSkills','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','petExperience','overseasWorkDetails','employmentHistory','overseasExperiences','employmentExperiences','remarks','caregiverDuringOverseas','childrenAges','brotherAges','sisterAges']);
async function createWorkerResumePdf(worker, lang='zh') {
  const profile=worker.resume_profile&&typeof worker.resume_profile==='object'?worker.resume_profile:{};
  const logicalWidth=794,logicalHeight=1123,scale=1.5,pages=[];
  const pdfText=value=>lang==='en'?translateHrText(value,'en'):value;
  const languageName=value=>lang==='en'?translateHrText(value,'en'):({English:'英文',Tagalog:'菲律賓語',Cantonese:'廣東話',Mandarin:'中文',Others:'其他'}[value]||value);
  const pdfLanguageLevels=(options,value)=>{
    const selected=resumeChoiceList(options);
    if(!selected.length)return String(value||'');
    const levels=readLanguageLevels(value,selected),labels=lang==='en'?{basic:'Basic',medium:'Intermediate',native:'Native'}:{basic:'基礎',medium:'中等',native:'本地'};
    return selected.map(language=>`${languageName(language)} (${labels[levels[language]]||labels.basic})`).join(lang==='en'?'; ':'、');
  };
  const pdfLabel=value=>lang==='en'?translateHrText(value,'en'):value;
  const pdfValue=(key,value)=>{
    if(lang==='en')return value==='是'?'Yes':value==='否'?'No':String(value);
    if(key==='cookingSkills'||key==='applianceOptions'||key==='childcareSkills'){
      const translations={'Washing Machine':'洗衣機',Oven:'烤箱','Vacuum Cleaner':'吸塵器','Microwave Oven':'微波爐','Dish Washer':'洗碗機','Sterilizing utensils':'器具消毒',Feeding:'餵食','Taking temperature':'量體溫',Others:'其他',Bathing:'洗澡','Changing diapers':'更換尿布'};
      return String(value).split(/[,，、;；|]/).map(item=>translations[item.trim()]||item.trim()).join('、');
    }
    return String(value);
  };
  let resumePhoto=null;
  if(profile.photoDataUrl&&/^data:image\/(png|jpeg);base64,/.test(profile.photoDataUrl)){try{resumePhoto=new Image();resumePhoto.src=profile.photoDataUrl;await new Promise((resolve,reject)=>{resumePhoto.onload=resolve;resumePhoto.onerror=reject});}catch{resumePhoto=null;}}
  let canvas,ctx,y;
  const ink='#23352e',muted='#66776e',green='#176b54',line='#dce6e1';
  const newPage=(first=false)=>{
    canvas=document.createElement('canvas');canvas.width=logicalWidth*scale;canvas.height=logicalHeight*scale;ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,logicalWidth,logicalHeight);
    ctx.fillStyle=green;ctx.fillRect(0,0,logicalWidth,10);
    if(first){ctx.fillStyle=green;ctx.font='700 13px Arial, sans-serif';ctx.fillText('KOLECION EMPLOYMENT AGENCY',48,48);ctx.fillStyle=ink;ctx.font='700 32px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillText(lang==='en'?'WORKER RESUME':'工作者履歷',48,91);ctx.font='400 15px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=muted;ctx.fillText(lang==='en'?'Worker resume':'工作者履歷',48,119);ctx.font='700 25px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;ctx.fillText(String(worker.name||(lang==='en'?'Worker':'工作者')),48,166);const summary=[worker.nationality,pdfText(worker.job_preference||'')].filter(Boolean).join(' · ');ctx.font='400 14px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=muted;ctx.fillText(summary,48,192);y=232;
      if(resumePhoto){ctx.drawImage(resumePhoto,logicalWidth-145,42,96,124);}
    }else{ctx.fillStyle=ink;ctx.font='700 16px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillText(String(worker.name||(lang==='en'?'Worker':'工作者')),48,48);ctx.font='400 11px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=muted;ctx.fillText(lang==='en'?'WORKER RESUME · CONTINUED':'工作者履歷 · 接續',48,69);y=96;}
    pages.push(canvas);
  };
  const wrap=(text,maxWidth,font)=>{ctx.font=font;const lines=[];for(const paragraph of String(text||'').split(/\r?\n/)){if(!paragraph){lines.push('');continue;}let line='';for(const char of paragraph){const candidate=line+char;if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=char;}else line=candidate;}lines.push(line);}return lines;};
  const ensureSpace=height=>{if(y+height>logicalHeight-58)newPage(false);};
  newPage(true);
  const contact=(lang==='en'?[['Nationality',worker.nationality],['Phone',worker.phone],['Email',worker.email],['Job preference',pdfText(worker.job_preference||'')]]:[['國籍',worker.nationality],['電話',worker.phone],['電子郵件',worker.email],['工作意向',pdfText(worker.job_preference||'')]]).filter(([,value])=>value);
  if(contact.length){ctx.fillStyle='#f3f8f5';ctx.fillRect(40,y-17,logicalWidth-80,Math.ceil(contact.length/2)*49+14);contact.forEach(([label,value],index)=>{const col=index%2,row=Math.floor(index/2),x=56+col*350,top=y+row*49;ctx.font='700 10px Arial, sans-serif';ctx.fillStyle=muted;ctx.fillText(label.toUpperCase(),x,top);ctx.font='400 13px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;ctx.fillText(String(value),x,top+21,320);});y+=Math.ceil(contact.length/2)*49+22;}
  for(const group of WORKER_RESUME_GROUPS){
    const fields=group.fields.filter(([key])=>resumeFieldText(profile,key));if(!fields.length)continue;
    ensureSpace(48);ctx.fillStyle=green;ctx.fillRect(44,y-15,4,25);ctx.font='700 15px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;ctx.fillText(pdfText(group.title),58,y+3);ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(58,y+12);ctx.lineTo(logicalWidth-48,y+12);ctx.stroke();y+=34;
    let column=0,rowHeight=0;
    for(const [key,label] of fields){
      const rawValue=key==='languages'?pdfLanguageLevels(profile.languageOptions,profile.languages):resumeFieldText(profile,key);
      const value=pdfValue(key,rawValue),wide=RESUME_LONG_FIELDS.has(key);
      if(wide&&column){y+=rowHeight+12;column=0;rowHeight=0;}
      if(wide){
        const lines=wrap(value,logicalWidth-112,'400 12px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif');
        ensureSpace(38);ctx.font='700 10px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=muted;ctx.fillText(pdfLabel(label).toUpperCase(),58,y);y+=19;
        ctx.font='400 12px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;
        for(const text of lines){ensureSpace(19);ctx.fillText(text,58,y);y+=17;}
        y+=8;continue;
      }
      const colWidth=(logicalWidth-120)/2,x=58+column*(colWidth+18),lines=wrap(value,colWidth,'400 12px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif'),h=32+lines.length*16;
      ensureSpace(h+8);ctx.font='700 10px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=muted;ctx.fillText(pdfLabel(label).toUpperCase(),x,y);
      ctx.font='400 12px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;lines.forEach((text,index)=>ctx.fillText(text,x,y+18+index*16));
      rowHeight=Math.max(rowHeight,h);column+=1;if(column===2){y+=rowHeight+12;column=0;rowHeight=0;}
    }
    if(column){y+=rowHeight+12;column=0;rowHeight=0;}y+=5;
  }
  if(worker.notes){ensureSpace(70);ctx.fillStyle=green;ctx.fillRect(44,y-15,4,25);ctx.font='700 15px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';ctx.fillStyle=ink;ctx.fillText(lang==='en'?'NOTES':'備註',58,y+3);y+=28;const lines=wrap(worker.notes,logicalWidth-112,'400 12px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif');lines.forEach(text=>{ensureSpace(18);ctx.fillStyle=ink;ctx.fillText(text,58,y);y+=17;});}
  pages.forEach((page,index)=>{const pctx=page.getContext('2d');pctx.save();pctx.scale(scale,scale);pctx.strokeStyle=line;pctx.beginPath();pctx.moveTo(44,logicalHeight-42);pctx.lineTo(logicalWidth-44,logicalHeight-42);pctx.stroke();pctx.font='400 10px Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif';pctx.fillStyle=muted;pctx.fillText(lang==='en'?'KOLECION · CONFIDENTIAL WORKER PROFILE':'KOLECION · 工作者履歷資料',48,logicalHeight-23);pctx.textAlign='right';pctx.fillText(`${lang==='en'?'PAGE':'第'} ${index+1} / ${pages.length}${lang==='en'?'':' 頁'}`,logicalWidth-48,logicalHeight-23);pctx.restore();});
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
  const blob=new Blob(objects,{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${lang==='en'?'worker-resume':'工作者履歷'}-${worker.id||'profile'}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function canEditEmployerOrder(order, routes, candidates) {
  return order.status === 'open'
    && !routes.some(route => Number(route.job_order_id) === Number(order.id))
    && !candidates.some(candidate => Number(candidate.job_order_id) === Number(order.id));
}

function MemberRoleHome({data,cases,requirements,openTab}) {
  const openTasks=(data.tasks||[]).filter(task=>task.status!=='done');
  if(data.role==='worker'){
    const needsCorrection=requirements.filter(item=>item.required&&item.applicable&&['missing','returned'].includes(item.status));
    const pendingReview=requirements.filter(item=>item.status==='submitted');
    return <section className="hr-member-card member-role-home"><div className="member-home-heading"><div><span className="orders-eyebrow">MY WORKSPACE</span><h2>我的案件與待辦</h2><p>先查看案件進度，以及需要補交或等待審核的文件。</p></div></div><div className="member-home-metrics"><article><strong>{cases.length}</strong><span>申辦案件</span></article><article><strong>{needsCorrection.length}</strong><span>待補必要文件</span></article><article><strong>{pendingReview.length}</strong><span>審核中</span></article></div>{needsCorrection.length>0&&<p className="member-home-alert">有 {needsCorrection.length} 份必要文件需要上傳或補件。</p>}{cases.length?<div className="member-home-case-list">{cases.map(item=><article key={item.id}><div><strong>{item.case_number} · {item.employer_name}</strong><p>目前階段：{item.stage} · {openTasks.filter(task=>Number(task.case_id)===Number(item.id)).length} 項待辦</p></div><button type="button" onClick={()=>openTab('process')}>查看進度</button></article>)}</div>:<p>目前沒有連結的申辦案件；文件及赴台程序會在正式建立案件後顯示。</p>}<div className="member-home-actions"><button type="button" onClick={()=>openTab('documents')}>查看必要文件</button><button type="button" onClick={()=>openTab('process')}>查看赴台程序</button></div></section>;
  }
  if(data.role==='employer'){
    const orders=data.jobOrders||[];
    const candidates=data.orderCandidates||[];
    const nominated=candidates.filter(item=>item.status==='proposed').length;
    const interviews=candidates.filter(item=>item.status==='scheduled').length;
    const hired=candidates.filter(item=>item.status==='passed').length;
    return <section className="hr-member-card member-role-home"><div className="member-home-heading"><div><span className="orders-eyebrow">EMPLOYER WORKSPACE</span><h2>需求媒合進度</h2><p>從建立需求、查看推薦人選，到安排面試與錄用，都可以在需求單追蹤。</p></div><button type="button" onClick={()=>openTab('agencyEmployer')}>前往我的需求</button></div><div className="member-home-metrics"><article><strong>{orders.length}</strong><span>需求單</span></article><article><strong>{nominated}</strong><span>待查看推薦</span></article><article><strong>{interviews}</strong><span>面試安排中</span></article><article><strong>{hired}</strong><span>已錄用</span></article></div>{orders.length?<div className="member-home-case-list">{orders.slice(0,5).map(order=>{const assigned=(data.orderAgencies||[]).some(row=>Number(row.job_order_id)===Number(order.id));const people=candidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id));const step=people.some(candidate=>candidate.status==='passed')?4:people.some(candidate=>candidate.status==='scheduled')?3:people.some(candidate=>candidate.status==='proposed')?2:assigned?1:0;const steps=['需求已建立','仲介受理','收到推薦','安排面試','完成錄用'];return <article key={order.id}><div className="member-order-progress"><strong>需求單 #{order.id} · {order.job_type}</strong><ol>{steps.map((label,index)=><li className={index<=step?'complete':''} key={label}>{label}</li>)}</ol><p>錄用人選會建立正式申辦案件；確認前請先核對人選與需求。</p></div><button type="button" onClick={()=>openTab('agencyEmployer')}>查看人選</button></article>})}</div>:<p>尚未建立需求單。前往「仲介／雇主資料」開始建立需求。</p>}</section>;
  }
  if(data.role==='agency'){
    const taiwan=data.agencyType==='taiwan';
    const casesTotal=cases.length;
    const openOrders=(data.jobOrders||[]).filter(order=>order.status==='open').length;
    const recommendations=(data.orderCandidates||[]).filter(candidate=>candidate.status==='proposed').length;
    return <section className="hr-member-card member-role-home"><div className="member-home-heading"><div><span className="orders-eyebrow">{taiwan?'TAIWAN AGENCY':'PHILIPPINES AGENCY'}</span><h2>{taiwan?'業務工作摘要':'Staff 工作摘要'}</h2><p>{taiwan?'追蹤所屬雇主、需求單與申辦案件。':'查看收到的工作需求、推薦工作者，並追蹤審核中的文件。'}</p></div><button type="button" onClick={()=>openTab(taiwan?'agencyEmployer':'agencyEmployer')}>前往工作清單</button></div><div className="member-home-metrics"><article><strong>{casesTotal}</strong><span>相關案件</span></article><article><strong>{openOrders}</strong><span>媒合中需求</span></article><article><strong>{recommendations}</strong><span>待面試推薦</span></article><article><strong>{openTasks.length}</strong><span>未完成待辦</span></article></div><div className="member-home-actions"><button type="button" onClick={()=>openTab('agencyEmployer')}>{taiwan?'查看雇主與需求單':'查看需求與推薦流程'}</button><button type="button" onClick={()=>openTab('documents')}>處理必要文件</button><button type="button" onClick={()=>openTab('process')}>更新來台程序</button></div></section>;
  }
  return null;
}

function DocumentGuideMeta({ guide }) {
  return <div className="document-meta">
    {guide.agency&&<span><em>辦理單位</em>{guide.agency}</span>}
    {guide.time&&<span><em>預估時間</em>{guide.time}</span>}
    {guide.cost&&<span><em>費用</em>{guide.cost}</span>}
    {guide.tag&&<span className={`guide-tag tag-${guide.tag}`}>{guide.tag==='estimate'?'估計':'查證'}</span>}
    {guide.note&&<p>{guide.note}</p>}
  </div>;
}

function GuideTag({ tag }) {
  return tag?<span className={`guide-tag tag-${tag}`}>{tag==='estimate'?'估計':'查證'}</span>:null;
}

function WorkerStageDocuments({ workerName, caseItem, requirements, steps, acknowledgments, renderDocumentItem, onAcknowledge }) {
  const [openStages, setOpenStages] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const confirmed = new Map(acknowledgments.map(item => [item.ack_key, item.confirmed_at]));
  const rows = WORKER_STAGES.map(stage => {
    const documents = requirements.filter(item => stageOfRequirement(item.name) === stage.key);
    const known = stage.steps.map(key => steps.find(item => item.step_key === key)).filter(Boolean);
    const extra = stage.fallback ? steps.filter(item => stageOfStep(item.step_key) === stage.key && !stage.steps.includes(item.step_key)) : [];
    const stageSteps = [...known, ...extra];
    const acks = stage.acks || [];
    const total = documents.length + stageSteps.length + acks.length;
    const done = documents.filter(item => !item.applicable || item.status === 'approved').length
      + stageSteps.filter(item => item.completed_on).length + acks.filter(item => confirmed.has(item.key)).length;
    return { stage, documents, stageSteps, acks, total, done };
  });
  const totalAll = rows.reduce((sum, row) => sum + row.total, 0);
  const doneAll = rows.reduce((sum, row) => sum + row.done, 0);
  const currentKey = (rows.find(row => row.total > 0 && row.done < row.total) || {}).stage?.key || '';
  async function act(key, value) {
    if (!caseItem) return;
    setBusyKey(key);
    try { await onAcknowledge(caseItem.id, key, value); } finally { setBusyKey(''); }
  }
  return <div className="worker-case">
    <h3>{caseItem ? `${caseItem.case_number} · ${caseItem.employer_name}` : workerName}</h3>
    <div className="stage-overall"><div><strong>整體進度</strong><span>{doneAll}/{totalAll}</span></div><progress value={doneAll} max={totalAll || 1} /></div>
    <div className="stage-list">
      {rows.map(({ stage, documents, stageSteps, acks, total, done }) => {
        const isOpen = stage.key in openStages ? openStages[stage.key] : stage.key === currentKey;
        const isCurrent = stage.key === currentKey;
        return <section key={stage.key} className={`stage-card${isCurrent ? ' stage-current' : ''}${total > 0 && done === total ? ' stage-done' : ''}`}>
          <button type="button" className="stage-toggle" aria-expanded={isOpen} onClick={() => setOpenStages(prev => ({ ...prev, [stage.key]: !isOpen }))}>
            <span className="stage-badge">{stage.key}</span>
            <span className="stage-heading"><strong>{stage.title}</strong>{stage.duration&&<small>{stage.duration}</small>}</span>
            {isCurrent&&<span className="stage-current-tag">目前階段</span>}
            {total > 0&&<span className="stage-count">{done}/{total}</span>}
            <ChevronDown size={18} aria-hidden="true" className="stage-chevron" />
          </button>
          {isOpen&&<div className="stage-body">
            <p className="stage-summary">{stage.summary}</p>
            {documents.length > 0&&<div className="stage-section"><h4>文件</h4>{documents.map(item => renderDocumentItem(item, DOCUMENT_GUIDE[item.name]))}</div>}
            {stageSteps.length > 0&&<div className="stage-section"><h4>辦理進度</h4>{stageSteps.map(step => <div className="stage-step" key={step.step_key}>
              <div><strong>{step.label}</strong>{step.note&&<small>{step.note}</small>}</div>
              {step.completed_on&&<time>{String(step.completed_on).slice(0, 10)}</time>}
              <span className={`doc-status ${step.completed_on ? 'doc-approved' : step.started_on ? 'doc-submitted' : 'doc-missing'}`}>{step.completed_on ? '已完成' : step.started_on ? '進行中' : '尚未開始'}</span>
            </div>)}</div>}
            {acks.length > 0&&<div className="stage-section"><h4>請你確認</h4>{!caseItem&&<p className="stage-empty">建立案件後才能確認以下項目。</p>}{acks.map(ack => {
              const when = confirmed.get(ack.key);
              return <div key={ack.key} className={`stage-ack${when ? ' is-confirmed' : ''}`}>
                <p>{ack.text}</p>
                {when ? <div className="stage-ack-done"><span className="stage-ack-check"><Check size={14} aria-hidden="true" />已確認</span><time>{String(when).slice(0, 10)}</time><button type="button" className="table-action" disabled={!caseItem || busyKey === ack.key} onClick={() => act(ack.key, false)}>取消確認</button></div>
                  : <button type="button" disabled={!caseItem || busyKey === ack.key} onClick={() => act(ack.key, true)}>我已確認</button>}
              </div>;
            })}</div>}
            {(stage.tips || []).length > 0&&<div className="stage-section"><h4>注意事項</h4><ul className="stage-tips">{stage.tips.map((tip, index) => <li key={index}><span>{tip.text}</span><GuideTag tag={tip.tag} /></li>)}</ul></div>}
            {(stage.info || []).length > 0&&<div className="stage-section"><h4>須知</h4>{stage.info.map((info, index) => <div className="stage-info" key={index}>{info.title&&<strong>{info.title}</strong>}<p>{info.text}</p><GuideTag tag={info.tag} /></div>)}</div>}
            {total === 0 && !(stage.info || []).length && !(stage.tips || []).length&&<p className="stage-empty">此階段沒有需要你處理的項目。</p>}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}

function PortalStyles() {
  return <style jsx global>{`
.hr-member-shell .hr-member-pending{max-width:600px;margin:30px auto}
.hr-member-shell .hr-member-pending h2{margin:0 0 12px;color:#176b54}
.hr-member-shell .hr-member-pending p{line-height:1.7}
.hr-member-shell .hr-member-pending form{display:grid;gap:16px;margin-top:20px}
.hr-member-shell .hr-member-pending label{display:grid;gap:8px;color:#43584f;font-weight:700}
.hr-member-shell .hr-member-pending select{min-height:44px;padding:8px 12px;border:1px solid #ccd9d2;border-radius:9px;background:#fff;font:inherit}
.hr-member-shell .hr-member-pending form button{min-height:44px}
.hr-member-shell .application-review-heading{position:relative;padding:8px 4px 20px 70px}
.hr-member-shell .application-review-icon{position:absolute;top:8px;left:2px;display:grid;place-items:center;width:50px;height:50px;border-radius:15px;background:#e8f3ed;color:#176b54}
.hr-member-shell .application-review-icon svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.hr-member-shell .application-review-eyebrow{display:inline-block;margin:4px 10px 14px 0;color:#71837a;font-size:12px;font-weight:800;letter-spacing:.08em}
.hr-member-shell .application-review-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid #f1dfb6;border-radius:999px;background:#fff8e8;color:#92620d;font-size:11px;font-weight:800}
.hr-member-shell .application-review-badge:before{width:6px;height:6px;border-radius:50%;background:#d59b27;content:''}
.hr-member-shell .application-review-heading h2{margin:0 0 8px!important;color:#193c30!important;font-size:21px;line-height:1.4}
.hr-member-shell .application-review-heading p{margin:0;color:#65776e;font-size:14px;line-height:1.7}
.hr-member-shell .application-review-steps{display:grid;gap:0;margin:4px 0 20px;padding:0;list-style:none}
.hr-member-shell .application-review-steps li{position:relative;display:flex;align-items:flex-start;gap:12px;min-height:56px;margin:0;padding:0 0 12px;color:#9aa69f}
.hr-member-shell .application-review-steps li:not(:last-child):after{position:absolute;top:29px;left:13px;width:1px;height:calc(100% - 17px);background:#dfe8e2;content:''}
.hr-member-shell .application-review-steps li>span{z-index:1;display:grid;flex:0 0 27px;place-items:center;width:27px;height:27px;border:1px solid #dce6e1;border-radius:50%;background:#fff;font-size:12px;font-weight:800}
.hr-member-shell .application-review-steps li>div{display:grid;gap:3px;padding-top:1px}
.hr-member-shell .application-review-steps strong{color:#506158;font-size:13px}
.hr-member-shell .application-review-steps small{color:#87948d;font-size:12px;line-height:1.5}
.hr-member-shell .application-review-steps .application-review-step-done>span{border-color:#176b54;background:#176b54;color:#fff}
.hr-member-shell .application-review-steps .application-review-step-current>span{border:2px solid #176b54;color:#176b54}
.hr-member-shell .application-review-steps .application-review-step-current strong{color:#176b54}
.hr-member-shell .application-review-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;border:1px solid #e5ece7;border-radius:12px;background:#f8faf9}
.hr-member-shell .application-review-details>div{display:grid;gap:5px;min-width:0}
.hr-member-shell .application-review-details span{color:#829087;font-size:11px;font-weight:700}
.hr-member-shell .application-review-details strong{overflow-wrap:anywhere;color:#2e473a;font-size:14px}
.hr-member-shell .application-review-note{margin:15px 2px 0!important;color:#65776e;font-size:13px}
.hr-member-shell.hr-member-registration{background:radial-gradient(ellipse at 12% 0%,#dcefe5 0,transparent 36%),linear-gradient(145deg,#f2f7f4,#edf3f7 55%,#f8f5ed)}
.hr-member-shell.hr-member-registration .application-header{max-width:760px;margin:0 auto 22px;padding:16px 20px;border:1px solid #ffffffb8;border-radius:16px;background:#ffffffd9;box-shadow:0 8px 24px #1836290d;backdrop-filter:blur(8px)}
.hr-member-shell.hr-member-registration .application-header span{font-size:12px;letter-spacing:.08em}
.hr-member-shell.hr-member-registration .application-header h1{margin:3px 0;font-size:20px}
.hr-member-shell.hr-member-registration .application-header p{margin:0;font-size:12px}
.hr-member-shell.hr-member-registration .application-header button{background:#edf4ef;color:#315b47}
.hr-member-shell.hr-member-registration .hr-member-pending{max-width:760px;padding:0;overflow:hidden;border:1px solid #dce8e0;border-radius:20px;box-shadow:0 20px 55px #18362912}
.hr-member-shell .application-form-hero{position:relative;overflow:hidden;padding:32px 38px 26px;background:linear-gradient(115deg,#145d49,#22866a 62%,#43a07d);color:#fff}
.hr-member-shell .application-form-hero:after{position:absolute;top:-110px;right:-65px;width:270px;height:270px;border:1px solid #ffffff24;border-radius:50%;box-shadow:0 0 0 34px #ffffff0d,0 0 0 68px #ffffff09;content:'';pointer-events:none}
.hr-member-shell .application-form-kicker{display:inline-block;margin-bottom:12px;color:#d4f1df;font-size:10px;font-weight:800;letter-spacing:.16em}
.hr-member-shell .application-form-hero h2{margin:0 0 8px!important;color:#fff!important;font-size:25px;line-height:1.35}
.hr-member-shell .application-form-hero>p{max-width:480px;margin:0;color:#e3f2e9;font-size:14px;line-height:1.7}
.hr-member-shell .application-form-steps{position:relative;z-index:1;display:flex;align-items:center;gap:0;margin:24px 0 0;padding:0;list-style:none}
.hr-member-shell .application-form-steps li{display:flex;align-items:center;gap:8px;margin:0;color:#c5e0d1;font-size:11px;white-space:nowrap}
.hr-member-shell .application-form-steps li:not(:last-child):after{width:34px;height:1px;margin:0 12px;background:#ffffff52;content:''}
.hr-member-shell .application-form-steps li>span{display:grid;place-items:center;width:23px;height:23px;border:1px solid #ffffff6b;border-radius:50%;font-size:11px;font-weight:800}
.hr-member-shell .application-form-steps li.is-current{color:#fff;font-weight:800}
.hr-member-shell .application-form-steps li.is-current>span{border-color:#fff;background:#fff;color:#176b54}
.hr-member-shell .application-form{display:grid;gap:12px;padding:28px 38px 32px}
.hr-member-shell .application-form-section-title{display:flex;align-items:center;gap:11px;margin:0 0 2px}
.hr-member-shell .application-form-section-title>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e8f3ed;color:#176b54;font-size:11px;font-weight:800}
.hr-member-shell .application-form-section-title h3{margin:0;color:#213b2f;font-size:15px}
.hr-member-shell .application-form-section-title p{margin:3px 0 0;color:#829087;font-size:12px}
.hr-member-shell .application-form-agency-title{margin-top:8px}
.hr-member-shell .application-form>label{display:grid;gap:8px;color:#43584f;font-size:12px;font-weight:800}
.hr-member-shell .application-form select{width:100%;min-height:49px;padding:10px 13px;border:1px solid #d6e2da;border-radius:11px;background:#fbfdfb;color:#243b30;font:inherit;font-size:14px;outline:none;transition:border-color .18s,box-shadow .18s}
.hr-member-shell .application-form select:focus{border-color:#258064;box-shadow:0 0 0 3px #25806420}
.hr-member-shell .application-form-empty{margin:0;padding:11px 13px;border:1px solid #f1dfb6;border-radius:10px;background:#fff9ed;color:#8a641c!important;font-size:13px}
.hr-member-shell .application-form-notice{display:flex;align-items:flex-start;gap:10px;margin-top:3px;padding:12px 14px;border:1px solid #e5ece7;border-radius:11px;background:#f6f9f7}
.hr-member-shell .application-form-notice>span{display:grid;flex:0 0 19px;place-items:center;width:19px;height:19px;border-radius:50%;background:#e2eee6;color:#176b54;font-size:12px;font-weight:800}
.hr-member-shell .application-form-notice p{margin:0;color:#63756b;font-size:12px;line-height:1.65}
.hr-member-shell .application-form .application-form-submit{display:flex;align-items:center;justify-content:center;gap:10px;min-height:49px;margin-top:3px;border-radius:11px;background:linear-gradient(100deg,#176b54,#27866b);box-shadow:0 7px 16px #176b5426;color:#fff;font-size:14px;transition:transform .18s,box-shadow .18s}
.hr-member-shell .application-form .application-form-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 20px #176b5433}
.hr-member-shell .application-form .application-form-submit:disabled{background:#a6b8ad;box-shadow:none;cursor:not-allowed}
.hr-member-shell .application-form .application-form-submit span{font-size:18px;line-height:1}
@media(max-width:540px){.hr-member-shell .application-review-heading{padding-left:0;padding-top:65px}
.hr-member-shell .application-review-icon{top:0;left:0}
.hr-member-shell .application-review-details{grid-template-columns:1fr}}
@media(max-width:600px){.hr-member-shell.hr-member-registration{padding:16px}
.hr-member-shell.hr-member-registration .application-header{padding:13px 15px}
.hr-member-shell .application-form-hero{padding:25px 22px 22px}
.hr-member-shell .application-form-hero h2{font-size:22px}
.hr-member-shell .application-form{padding:23px 22px 25px}
.hr-member-shell .application-form-steps{justify-content:space-between}
.hr-member-shell .application-form-steps li{gap:6px;font-size:10px}
.hr-member-shell .application-form-steps li:not(:last-child):after{width:12px;margin:0 3px}}
@keyframes hr-portal-fade{from{opacity:0}to{opacity:1}}
@keyframes hr-portal-rise{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
@keyframes hr-portal-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.hr-member-shell{--g-950:#0c3327;--g-800:#134e3b;--g-700:#176b54;--g-600:#1f8366;--g-500:#2f9d7c;--g-200:#cfe8dc;--g-100:#e4f3ec;--g-50:#f2f9f5;
  --ink:#14231d;--ink-2:#425449;--ink-3:#72837a;--line:#e1e9e4;--line-soft:#edf2ee;
  --amber:#a8690a;--amber-bg:#fff4dc;--red:#b42318;--red-bg:#fdecea;--blue:#245f9e;--blue-bg:#e7f0fa;
  --radius:18px;--radius-sm:11px;
  --shadow-sm:0 1px 2px rgba(15,45,33,.05),0 3px 10px rgba(15,45,33,.05);
  --shadow-md:0 10px 30px rgba(15,45,33,.10);
  --ring:0 0 0 3px rgba(31,131,102,.24);
  min-height:100vh;padding:clamp(14px,3.5vw,44px);color:var(--ink);line-height:1.55;
  font-family:Inter,"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,-apple-system,"Segoe UI",sans-serif;
  background:radial-gradient(900px 420px at 8% -8%,#d6eee2 0,transparent 60%),radial-gradient(760px 380px at 100% 0,#e5eef8 0,transparent 55%),#f2f6f3;}
.hr-member-shell>section:first-child{max-width:560px;margin:10vh auto;padding:32px;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow-md)}
.hr-member-shell>section:first-child span{color:var(--g-600);font-size:12px;font-weight:800;letter-spacing:.12em}
.hr-member-shell>section:first-child h1{margin:8px 0 10px;font-size:24px;color:var(--ink)}
.hr-member-shell .hr-member-header{position:relative;overflow:hidden;max-width:1100px;margin:0 auto 18px;padding:22px 26px;display:flex;justify-content:space-between;align-items:center;gap:18px;border-radius:22px;color:#fff;background:linear-gradient(118deg,var(--g-950),var(--g-700) 62%,var(--g-500));box-shadow:var(--shadow-md);animation:hr-portal-in .45s ease both}
.hr-member-shell .hr-member-header::after{content:'';position:absolute;top:-120px;right:-70px;width:300px;height:300px;border-radius:50%;border:1px solid rgba(255,255,255,.16);box-shadow:0 0 0 36px rgba(255,255,255,.05),0 0 0 72px rgba(255,255,255,.04);pointer-events:none}
.hr-member-shell .hr-member-header>*{position:relative;z-index:1}
.hr-member-shell .hr-member-header-main{display:flex;align-items:center;gap:16px;min-width:0}
.hr-member-shell .hr-member-header span{display:block;color:rgba(255,255,255,.78);font-size:12px;font-weight:700;letter-spacing:.12em}
.hr-member-shell .hr-member-header .hr-member-avatar{display:grid;place-items:center;flex:none;width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.34);color:#fff;font-size:21px;font-weight:800;letter-spacing:0;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.hr-member-shell .hr-member-header h1{margin:4px 0 2px;font-size:clamp(20px,3vw,27px);font-weight:800;letter-spacing:-.01em;color:#fff;line-height:1.25}
.hr-member-shell .hr-member-header p{margin:0;color:rgba(255,255,255,.84);font-size:13px;overflow-wrap:anywhere}
.hr-member-shell .hr-member-header button{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-height:40px;padding:9px 16px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;backdrop-filter:blur(6px);transition:background .18s,transform .18s}
.hr-member-shell .hr-member-header button:hover{background:rgba(255,255,255,.26);transform:translateY(-1px)}
.hr-member-shell .hr-member-header button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.hr-member-shell .workspace-tabs{position:sticky;top:10px;z-index:20;display:flex;gap:6px;max-width:1100px;margin:0 auto 20px;padding:6px;overflow-x:auto;border:1px solid rgba(255,255,255,.9);border-radius:18px;background:rgba(255,255,255,.82);box-shadow:var(--shadow-sm),0 12px 30px rgba(15,45,33,.06);backdrop-filter:blur(14px);scrollbar-width:none}
.hr-member-shell .workspace-tabs::-webkit-scrollbar{display:none}
.hr-member-shell .workspace-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:1 0 auto;min-height:44px;padding:9px 18px;border:0;border-radius:13px;background:transparent;color:var(--ink-2);font:inherit;font-size:14px;font-weight:700;white-space:nowrap;cursor:pointer;transition:background .18s,color .18s,box-shadow .18s}
.hr-member-shell .workspace-tabs button svg{flex:none;opacity:.8}
.hr-member-shell .workspace-tabs button:hover{background:var(--g-50);color:var(--g-700)}
.hr-member-shell .workspace-tabs button.active{background:linear-gradient(135deg,var(--g-700),var(--g-500));color:#fff;box-shadow:0 6px 16px rgba(23,107,84,.32)}
.hr-member-shell .workspace-tabs button.active svg{opacity:1}
.hr-member-shell .workspace-tabs button:focus-visible{outline:none;box-shadow:var(--ring)}
.hr-member-shell .workspace-chat-page[hidden]{display:none}
.hr-member-shell .hr-member-card,.hr-member-shell .hr-member-footer{max-width:1100px;margin:0 auto 18px}
.hr-member-shell .hr-member-card{padding:24px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow-sm);animation:hr-portal-in .4s ease both}
.hr-member-shell .hr-member-card h2{margin:0 0 16px;font-size:18px;font-weight:800;color:var(--ink);letter-spacing:-.005em}
.hr-member-shell .hr-member-card>h2,.hr-member-shell .card-title h2{display:flex;align-items:center;gap:10px}
.hr-member-shell .hr-member-card>h2::before,.hr-member-shell .card-title h2::before{content:'';flex:none;width:4px;height:18px;border-radius:4px;background:linear-gradient(var(--g-500),var(--g-700))}
.hr-member-shell .hr-member-card h3{color:var(--ink)}
.hr-member-shell .hr-member-card p{color:var(--ink-3)}
.hr-member-shell .hr-member-card>ul{display:grid;gap:8px;padding:0;list-style:none}
.hr-member-shell .hr-member-card>ul>li{margin:0;padding:11px 14px;border:1px solid var(--line-soft);border-radius:12px;background:var(--g-50);color:var(--ink-2);font-weight:600}
.hr-member-shell .card-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
.hr-member-shell .card-title h2{margin:0}
.hr-member-shell .hr-member-footer{padding:10px 4px 6px;text-align:center;color:var(--ink-3);font-size:12px}
.hr-member-shell .hr-request-error,.hr-member-shell .hr-request-success{display:block;max-width:1100px;margin:0 auto 14px;padding:12px 16px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.6}
.hr-member-shell .application-submit-success{max-width:none;margin:0 0 16px;animation:application-submit-pop .35s ease-out}
@keyframes application-submit-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.hr-member-shell .application-submit-success{animation:none}}
.hr-member-shell .hr-request-error{border:1px solid #f4c7c2;background:var(--red-bg);color:var(--red)!important}
.hr-member-shell .hr-request-success{border:1px solid #bfe3d0;background:var(--g-100);color:var(--g-700)!important}
.hr-member-shell .hr-member-card button,.hr-member-shell .progress-modal button.worker-delete-confirm,.hr-member-shell .progress-modal .worker-edit-actions button,.hr-member-shell .process-row button,.hr-member-shell .progress-step button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 16px;border:0;border-radius:11px;background:linear-gradient(135deg,var(--g-700),var(--g-600));color:#fff;font:inherit;font-size:14px;font-weight:700;line-height:1.2;cursor:pointer;box-shadow:0 4px 12px rgba(23,107,84,.22);transition:transform .16s,box-shadow .16s,filter .16s}
.hr-member-shell .hr-member-card button:hover:not(:disabled),.hr-member-shell .progress-modal .worker-edit-actions button:hover:not(:disabled),.hr-member-shell .process-row button:hover:not(:disabled),.hr-member-shell .progress-step button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 18px rgba(23,107,84,.28);filter:brightness(1.04)}
.hr-member-shell .hr-member-card button:focus-visible,.hr-member-shell .progress-modal button:focus-visible{outline:none;box-shadow:var(--ring)}
.hr-member-shell .hr-member-card button:disabled,.hr-member-shell .progress-modal button:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.hr-member-shell button.light-action,.hr-member-shell button.table-action,.hr-member-shell button.worker-edit-cancel,.hr-member-shell button.profile-edit-action,.hr-member-shell .progress-modal button.worker-edit-cancel,.hr-member-shell .progress-modal button.profile-edit-action{min-height:34px;padding:7px 12px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink-2);font-size:13px;font-weight:700;box-shadow:none;margin-right:6px}
.hr-member-shell button.light-action:hover:not(:disabled),.hr-member-shell button.table-action:hover:not(:disabled),.hr-member-shell button.worker-edit-cancel:hover:not(:disabled),.hr-member-shell button.profile-edit-action:hover:not(:disabled){background:var(--g-50);border-color:var(--g-200);color:var(--g-700);transform:none;box-shadow:none;filter:none}
.hr-member-shell button.worker-edit-cancel,.hr-member-shell .progress-modal button.worker-edit-cancel,.hr-member-shell .progress-modal button.profile-edit-action{min-height:40px;padding:9px 16px;font-size:14px;margin-right:0}
.hr-member-shell .progress-modal .worker-edit-actions button.worker-edit-cancel{background:#fff;color:var(--ink-2);box-shadow:none}
.hr-member-shell button.table-action:last-child{margin-right:0}
.hr-member-shell button.worker-link{min-height:0;padding:0;border:0;background:none;color:var(--g-700);font:inherit;font-weight:800;text-decoration:underline;text-decoration-color:var(--g-200);text-underline-offset:4px;box-shadow:none;margin:0}
.hr-member-shell button.worker-link:hover:not(:disabled){background:none;color:var(--g-600);text-decoration-color:currentColor;transform:none;box-shadow:none;filter:none}
.hr-member-shell .worker-delete-confirm{background:linear-gradient(135deg,#b42318,#d0382b)!important;box-shadow:0 4px 12px rgba(180,35,24,.25)!important}
.hr-member-shell .progress-modal button.progress-modal-close{display:grid;place-items:center;flex:none;width:40px;height:40px;min-height:0;padding:0;border:0;border-radius:50%;background:var(--line-soft);color:var(--ink-2);font-size:26px;line-height:1;box-shadow:none}
.hr-member-shell .progress-modal button.progress-modal-close:hover:not(:disabled){background:var(--g-100);color:var(--g-700);transform:none;box-shadow:none}
.hr-member-shell .candidate-actions button,.hr-member-shell .hr-member-card .candidate-actions button{min-height:32px;padding:6px 11px;border:1px solid var(--g-200);border-radius:9px;background:#fff;color:var(--g-700);font-size:12.5px;font-weight:700;box-shadow:none}
.hr-member-shell .candidate-actions button:hover:not(:disabled),.hr-member-shell .hr-member-card .candidate-actions button:hover:not(:disabled){background:var(--g-100);transform:none;box-shadow:none;filter:none}
.hr-member-shell .hr-member-card .candidate-actions button.candidate-reject{color:var(--red);border-color:#f0cdc9}
.hr-member-shell .hr-member-card .candidate-actions button.candidate-reject:hover:not(:disabled){background:var(--red-bg)}
.hr-member-shell .member-home-actions button{min-height:40px;border:1px solid var(--g-200);background:#fff!important;color:var(--g-700)!important;box-shadow:none!important}
.hr-member-shell .member-home-actions button:hover:not(:disabled){background:var(--g-50)!important;transform:none!important}
.hr-member-shell button.resume-experience-add{border:1.5px dashed var(--g-500);background:var(--g-50);color:var(--g-700);box-shadow:none;min-height:40px;padding:9px 14px;border-radius:11px;font:inherit;font-weight:700;cursor:pointer}
.hr-member-shell button.resume-experience-add:hover{background:var(--g-100)}
.hr-member-shell button.resume-experience-remove{border:0;background:transparent;color:var(--red);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:4px 0}
.hr-member-shell .hr-member-card button.resume-experience-remove{background:transparent;color:var(--red);box-shadow:none;min-height:0;padding:4px 0;justify-self:start}
.hr-member-shell .worker-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.hr-member-shell .worker-form .form-wide{grid-column:1/-1}
.hr-member-shell .worker-form>button{justify-self:start}
.hr-member-shell .worker-form label,.hr-member-shell .resume-form-grid label,.hr-member-shell .resume-experience-row label,.hr-member-shell .agency-choice label,.hr-member-shell .process-row label,.hr-member-shell .progress-step label,.hr-member-shell .application-form>label,.hr-member-shell .return-document-form label,.hr-member-shell .resume-religion-field label{display:grid;align-content:start;gap:7px;min-width:0;color:var(--ink-2);font-size:12.5px;font-weight:700}
.hr-member-shell .hr-member-card input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=range]),.hr-member-shell .hr-member-card select,.hr-member-shell .hr-member-card textarea,.hr-member-shell .progress-modal input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=range]),.hr-member-shell .progress-modal select,.hr-member-shell .progress-modal textarea{box-sizing:border-box;width:100%;min-width:0;min-height:42px;padding:9px 12px;border:1px solid #d3dfd8;border-radius:11px;background:#fbfdfc;color:var(--ink);font:inherit;font-size:14px;font-weight:500;outline:none;transition:border-color .16s,box-shadow .16s,background .16s}
.hr-member-shell .hr-member-card textarea,.hr-member-shell .progress-modal textarea{resize:vertical;line-height:1.55}
.hr-member-shell .hr-member-card select,.hr-member-shell .progress-modal select{appearance:none;padding-right:36px;background-color:#fbfdfc;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%2372837a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;cursor:pointer}
.hr-member-shell .hr-member-card input::placeholder,.hr-member-shell .hr-member-card textarea::placeholder,.hr-member-shell .progress-modal input::placeholder,.hr-member-shell .progress-modal textarea::placeholder{color:#9aa9a0;font-weight:400}
.hr-member-shell .hr-member-card input:hover:not(:disabled):not([type=checkbox]):not([type=radio]),.hr-member-shell .hr-member-card select:hover:not(:disabled),.hr-member-shell .hr-member-card textarea:hover:not(:disabled),.hr-member-shell .progress-modal select:hover:not(:disabled),.hr-member-shell .progress-modal textarea:hover:not(:disabled){border-color:#b9cbc0}
.hr-member-shell .hr-member-card input:focus:not([type=checkbox]):not([type=radio]),.hr-member-shell .hr-member-card select:focus,.hr-member-shell .hr-member-card textarea:focus,.hr-member-shell .progress-modal input:focus:not([type=checkbox]):not([type=radio]),.hr-member-shell .progress-modal select:focus,.hr-member-shell .progress-modal textarea:focus{border-color:var(--g-600);background-color:#fff;box-shadow:var(--ring)}
.hr-member-shell .hr-member-card input:disabled,.hr-member-shell .hr-member-card select:disabled,.hr-member-shell .hr-member-card textarea:disabled,.hr-member-shell .progress-modal input:disabled,.hr-member-shell .progress-modal select:disabled{background-color:#f1f5f2;color:var(--ink-3);cursor:not-allowed}
.hr-member-shell .hr-member-card input[readonly]{background:#f1f5f2;color:var(--ink-2)}
.hr-member-shell .hr-member-card input[type=checkbox],.hr-member-shell .hr-member-card input[type=radio],.hr-member-shell .progress-modal input[type=checkbox],.hr-member-shell .progress-modal input[type=radio]{accent-color:var(--g-700);width:17px;height:17px;margin:0;cursor:pointer}
.hr-member-shell .hr-member-card small,.hr-member-shell .progress-modal small{color:var(--ink-3);font-weight:500}
.hr-member-shell .case-status{min-height:36px!important;width:auto!important;padding:6px 32px 6px 10px!important;font-size:13px!important;font-weight:700!important}
.hr-member-shell .agency-choice{display:flex;align-items:end;gap:14px;flex-wrap:wrap;padding:14px;border:1px solid var(--line-soft);border-radius:14px;background:var(--g-50)}
.hr-member-shell .agency-choice label{min-width:min(100%,260px);flex:1 1 220px}
.hr-member-shell .upload-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(150px,1fr) auto;align-items:center;gap:12px;padding:12px;margin-top:10px;border:1px dashed var(--g-200);border-radius:13px;background:var(--g-50)}
.hr-member-shell .upload-row>*,.hr-member-shell .process-row>*,.hr-member-shell .progress-step>*,.hr-member-shell .worker-form>*,.hr-member-shell .resume-form-grid>*{min-width:0}
.hr-member-shell .upload-row input[type=file]{box-sizing:border-box;width:100%;padding:7px 9px;min-height:40px;border:1px solid #d3dfd8;border-radius:10px;background:#fff;font:inherit;font-size:13px;cursor:pointer}
.hr-member-shell .upload-row input[type=file]::file-selector-button{margin-right:10px;padding:6px 11px;border:0;border-radius:8px;background:var(--g-100);color:var(--g-700);font:inherit;font-weight:700;cursor:pointer}
.hr-member-shell .hr-member-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
.hr-member-shell .hr-member-card table{width:100%;border-collapse:collapse;text-align:left}
.hr-member-shell .hr-member-card th{padding:12px 14px;background:#f6faf7;border-bottom:1px solid var(--line);color:var(--ink-3);font-size:12px;font-weight:800;letter-spacing:.04em;white-space:nowrap}
.hr-member-shell .hr-member-card td{padding:13px 14px;border-bottom:1px solid var(--line-soft);color:var(--ink);font-size:14px;white-space:nowrap}
.hr-member-shell .hr-member-card tbody tr{transition:background .14s}
.hr-member-shell .hr-member-card tbody tr:hover{background:#f8fbf9}
.hr-member-shell .hr-member-card tbody tr:last-child td{border-bottom:0}
.hr-member-shell .member-role-home{display:grid;gap:18px}
.hr-member-shell .member-home-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.hr-member-shell .member-home-heading h2{margin:5px 0 6px;font-size:21px}
.hr-member-shell .member-home-heading p{margin:0;max-width:640px;line-height:1.7}
.hr-member-shell .orders-eyebrow{display:inline-block;color:var(--g-600);font-size:11px;font-weight:800;letter-spacing:.16em}
.hr-member-shell .member-home-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.hr-member-shell .member-home-metrics article{position:relative;overflow:hidden;display:grid;gap:4px;padding:17px 18px 15px 22px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#fff,var(--g-50));transition:transform .18s,box-shadow .18s}
.hr-member-shell .member-home-metrics article:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm)}
.hr-member-shell .member-home-metrics article::before{content:'';position:absolute;inset:0 auto 0 0;width:5px;background:linear-gradient(var(--g-500),var(--g-700))}
.hr-member-shell .member-home-metrics strong{font-size:32px;line-height:1.1;color:var(--g-700);font-weight:800;font-variant-numeric:tabular-nums}
.hr-member-shell .member-home-metrics span{color:var(--ink-3);font-size:13px;font-weight:600}
.hr-member-shell .member-home-alert{margin:0;padding:12px 15px;border:1px solid #f1deb0;border-radius:12px;background:var(--amber-bg);color:var(--amber)!important;font-weight:700}
.hr-member-shell .member-home-case-list{display:grid;gap:10px}
.hr-member-shell .member-home-case-list>article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 16px;border:1px solid var(--line);border-radius:14px;background:#fff;transition:border-color .16s,box-shadow .16s}
.hr-member-shell .member-home-case-list>article:hover{border-color:var(--g-200);box-shadow:var(--shadow-sm)}
.hr-member-shell .member-home-case-list strong{color:var(--ink)}
.hr-member-shell .member-home-case-list p{margin:5px 0 0;font-size:13px}
.hr-member-shell .member-home-actions{display:flex;flex-wrap:wrap;gap:10px}
.hr-member-shell .member-order-progress{flex:1;min-width:0}
.hr-member-shell .member-order-progress ol{display:flex;flex-wrap:wrap;gap:8px 6px;margin:12px 0 4px;padding:0;list-style:none}
.hr-member-shell .member-order-progress li{position:relative;display:inline-flex;align-items:center;gap:7px;margin:0;padding:5px 12px 5px 9px;border-radius:999px;background:#f3f6f4;color:var(--ink-3);font-size:12.5px;font-weight:600}
.hr-member-shell .member-order-progress li::before{content:'';width:9px;height:9px;border-radius:50%;border:2px solid #c3d0c8;background:#fff}
.hr-member-shell .member-order-progress li.complete{background:var(--g-100);color:var(--g-700);font-weight:800}
.hr-member-shell .member-order-progress li.complete::before{border-color:var(--g-600);background:var(--g-600)}
.hr-member-shell .member-order-progress p{margin:6px 0 0;font-size:12.5px}
.hr-member-shell .workspace-basic-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}
.hr-member-shell .workspace-basic-fields>div{min-width:0;padding:14px 16px;border:1px solid var(--line-soft);border-radius:13px;background:var(--g-50)}
.hr-member-shell .workspace-basic-fields dt{color:var(--ink-3);font-size:12px;font-weight:700;letter-spacing:.03em}
.hr-member-shell .workspace-basic-fields dd{margin:5px 0 0;overflow-wrap:anywhere;color:var(--ink);font-weight:700}
.hr-member-shell .resume-profile-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:20px}
.hr-member-shell .resume-profile-header h2{margin:4px 0 6px;font-size:22px}
.hr-member-shell .resume-profile-header p{margin:0;line-height:1.7}
.hr-member-shell .resume-profile-header>div:last-child{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.hr-member-shell .resume-profile-header button{flex:none}
.hr-member-shell .resume-profile-header>div:last-child button:last-child{background:#fff;color:var(--g-700);border:1px solid var(--g-200);box-shadow:none}
.hr-member-shell .resume-contact{padding:16px 18px;margin-bottom:18px;border:1px solid var(--line-soft);border-radius:14px;background:linear-gradient(120deg,var(--g-50),#fff)}
.hr-member-shell .worker-detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 20px}
.hr-member-shell .worker-detail p{margin:0;color:var(--ink-2)!important;font-weight:600}
.hr-member-shell .resume-profile-photo{display:block;width:116px;height:150px;margin:0 0 16px;object-fit:cover;border:3px solid #fff;border-radius:14px;background:var(--g-50);box-shadow:0 0 0 1px var(--line),var(--shadow-sm)}
.hr-member-shell .worker-resume-sections{display:grid;gap:14px}
.hr-member-shell .worker-resume-section{padding:18px;border:1px solid var(--line-soft);border-radius:15px;background:#fcfdfc}
.hr-member-shell .worker-resume-section h3{display:flex;align-items:center;gap:9px;margin:0 0 14px;color:var(--g-700);font-size:15px;font-weight:800}
.hr-member-shell .worker-resume-section h3::before{content:'';width:4px;height:15px;border-radius:4px;background:linear-gradient(var(--g-500),var(--g-700))}
.hr-member-shell .resume-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 18px;margin:0}
.hr-member-shell .resume-fields>div{min-width:0}
.hr-member-shell .resume-fields dt{color:var(--ink-3);font-size:12px;font-weight:700}
.hr-member-shell .resume-fields dd{margin:4px 0 0;color:var(--ink);font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.hr-member-shell .resume-fields .resume-value-wide{grid-column:1/-1}
.hr-member-shell .resume-empty{margin:8px 0;padding:18px;border:1px dashed #cbd9d1;border-radius:13px;background:#fafcfb;color:var(--ink-3);text-align:center;font-size:13px}
.hr-member-shell .resume-experience-view{display:grid;gap:4px;padding:11px 14px;margin-bottom:8px;border:1px solid var(--line-soft);border-left:3px solid var(--g-500);border-radius:10px;background:#fff}
.hr-member-shell .resume-experience-view span{color:var(--ink-3);font-size:12.5px}
.hr-member-shell .resume-experience-view p{margin:2px 0 0;white-space:pre-wrap;color:var(--ink-2)}
.hr-member-shell .resume-form-section{min-width:0;margin:0;padding:18px;border:1px solid var(--line);border-radius:15px;background:#fcfdfc}
.hr-member-shell .resume-form-section h3,.hr-member-shell .resume-form-section legend{padding:0 6px;color:var(--g-700);font-size:15px;font-weight:800}
.hr-member-shell .resume-form-section h3{margin:0 0 14px;padding:0}
.hr-member-shell .resume-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.hr-member-shell .resume-form-grid .resume-field-wide{grid-column:1/-1}
.hr-member-shell .resume-choice-field,.hr-member-shell .resume-radio-field{grid-column:1/-1;min-width:0;margin:0;padding:12px 14px;border:1px solid var(--line);border-radius:13px;background:#fff}
.hr-member-shell .resume-choice-field legend,.hr-member-shell .resume-radio-field legend{padding:0 6px;color:var(--ink-2);font-size:12.5px;font-weight:700}
.hr-member-shell .resume-choice-list{display:flex;flex-wrap:wrap;gap:8px}
.hr-member-shell label.resume-choice-item{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink-2);cursor:pointer;transition:background .14s,border-color .14s}
.hr-member-shell label.resume-choice-item:hover{background:var(--g-50);border-color:var(--g-200)}
.hr-member-shell label.resume-choice-item:has(input:checked){background:var(--g-100);border-color:var(--g-500);color:var(--g-700)}
.hr-member-shell .resume-choice-item span{font-weight:600}
.hr-member-shell .resume-radio-field>div{display:flex;flex-wrap:wrap;gap:10px}
.hr-member-shell .resume-radio-field>div label{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink-2);font-weight:700;cursor:pointer}
.hr-member-shell .resume-radio-field>div label:has(input:checked){background:var(--g-100);border-color:var(--g-500);color:var(--g-700)}
.hr-member-shell .resume-language-field{display:grid;gap:10px}
.hr-member-shell label.resume-language-level{display:grid;grid-template-columns:minmax(100px,1fr) minmax(140px,220px);align-items:center;gap:10px;color:var(--ink-2);font-weight:700}
.hr-member-shell .resume-experience-editor{display:grid;gap:14px}
.hr-member-shell .resume-experience-editor>h4{margin:0;color:var(--ink-2);font-size:14px}
.hr-member-shell .resume-experience-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0;margin:0;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff}
.hr-member-shell .resume-experience-row legend{padding:0 7px;color:var(--g-700);font-size:13px;font-weight:800}
.hr-member-shell .resume-experience-row .resume-field-wide{grid-column:1/-1}
.hr-member-shell .resume-photo-field,.hr-member-shell .resume-file-field{display:grid;gap:8px;color:var(--ink-2);font-size:12.5px;font-weight:700}
.hr-member-shell .resume-photo-field img{display:block;width:76px;height:96px;object-fit:cover;border:1px solid var(--line);border-radius:10px}
.hr-member-shell .resume-import-box{display:grid;gap:8px;margin:0 0 16px;padding:14px 16px;border:1.5px dashed #a9cdbb;border-radius:14px;background:var(--g-50)}
.hr-member-shell .resume-import-box .resume-file-field{color:var(--g-700);font-weight:800}
.hr-member-shell .resume-import-box small{line-height:1.6}
.hr-member-shell .resume-import-box p{margin:0;color:var(--g-700)!important;font-size:13px;line-height:1.6}
.hr-member-shell .resume-completion{display:grid;gap:9px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(120deg,var(--g-50),#fff)}
.hr-member-shell .resume-completion>div{display:flex;justify-content:space-between;gap:12px;color:var(--ink-2);font-size:13px}
.hr-member-shell .resume-completion progress{width:100%;height:9px;border:0;border-radius:99px;overflow:hidden;accent-color:var(--g-600);background:var(--line-soft)}
.hr-member-shell .resume-completion progress::-webkit-progress-bar{background:var(--line-soft);border-radius:99px}
.hr-member-shell .resume-completion progress::-webkit-progress-value{background:linear-gradient(90deg,var(--g-600),var(--g-500));border-radius:99px}
.hr-member-shell .resume-completion progress::-moz-progress-bar{background:linear-gradient(90deg,var(--g-600),var(--g-500));border-radius:99px}
.hr-member-shell .orders-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
.hr-member-shell .orders-heading h2{margin:5px 0 6px;font-size:22px}
.hr-member-shell .orders-heading p{margin:0;max-width:680px;line-height:1.7}
.hr-member-shell .orders-count{flex:none;padding:8px 14px;border-radius:999px;background:var(--g-100);color:var(--g-700);font-size:12.5px;font-weight:800}
.hr-member-shell .order-form{padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--g-50)}
.hr-member-shell .order-form>button{min-height:44px;padding:10px 20px;grid-column:1/-1;justify-self:stretch}
.hr-member-shell .candidate-list p{margin:0;font-size:13.5px}
.hr-member-shell .orders-section{margin-top:30px}
.hr-member-shell .orders-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}
.hr-member-shell .orders-section-heading h3{margin:0;font-size:17px;font-weight:800;color:var(--ink)}
.hr-member-shell .orders-section-heading>span{color:var(--ink-3);font-size:12.5px;font-weight:600}
.hr-member-shell .job-order-card{overflow:hidden;margin:0 0 16px;border:1px solid var(--line);border-radius:17px;background:#fff;box-shadow:var(--shadow-sm);transition:box-shadow .18s}
.hr-member-shell .job-order-card:hover{box-shadow:var(--shadow-md)}
.hr-member-shell .job-order-header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;background:linear-gradient(110deg,var(--g-100),var(--g-50));border-bottom:1px solid var(--line)}
.hr-member-shell .job-order-number{color:var(--g-600);font-size:11.5px;font-weight:800;letter-spacing:.08em}
.hr-member-shell .job-order-header h4{margin:4px 0 0;color:var(--ink);font-size:18px;font-weight:800}
.hr-member-shell .order-status{flex:none;padding:6px 13px;border-radius:999px;background:var(--g-100);color:var(--g-700);font-size:12px;font-weight:800}
.hr-member-shell .order-status.status-open{background:var(--blue-bg);color:var(--blue)}
.hr-member-shell .order-status.status-sent{background:var(--amber-bg);color:var(--amber)}
.hr-member-shell .order-status.status-filled{background:#e9eeeb;color:#53635b}
.hr-member-shell .order-status.status-cancelled{background:var(--red-bg);color:var(--red)}
.hr-member-shell .job-order-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 20px;border-bottom:1px solid var(--line-soft)}
.hr-member-shell .job-order-facts>div{display:grid;gap:3px}
.hr-member-shell .job-order-facts small{color:var(--ink-3);font-size:11.5px;font-weight:700}
.hr-member-shell .job-order-facts strong{color:var(--ink);font-size:14px}
.hr-member-shell .job-order-description{margin:0;padding:14px 20px;border-bottom:1px solid var(--line-soft);color:var(--ink-2)!important;line-height:1.7;white-space:pre-wrap}
.hr-member-shell .order-agency-list{display:grid;gap:10px;padding:14px}
.hr-member-shell .order-agency-card{padding:14px 16px;border:1px solid var(--line-soft);border-radius:13px;background:#fcfdfc}
.hr-member-shell .order-agency-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.hr-member-shell .order-agency-heading>div{display:grid;gap:3px}
.hr-member-shell .order-agency-heading small,.hr-member-shell .candidate-card small{color:var(--ink-3);font-size:11.5px}
.hr-member-shell .order-agency-heading strong{color:var(--ink);font-size:14px}
.hr-member-shell .order-agency-heading>span{color:var(--ink-2);font-size:12.5px;text-align:right}
.hr-member-shell .order-routing{margin:9px 0 0;font-size:13px;line-height:1.6}
.hr-member-shell .candidate-list{display:grid;gap:8px;margin:0;padding:14px 16px 4px}
.hr-member-shell .order-agency-card .candidate-list{margin-top:12px;padding:12px 0 0;border-top:1px dashed var(--line)}
.hr-member-shell .candidate-list h5{margin:0;color:var(--ink-2);font-size:12.5px;font-weight:800}
.hr-member-shell .candidate-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:1px solid var(--line-soft);border-radius:11px;background:var(--g-50)}
.hr-member-shell .candidate-card>div:first-child{display:grid;gap:3px}
.hr-member-shell .candidate-card strong{color:var(--ink);font-size:14px}
.hr-member-shell .candidate-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.hr-member-shell .order-awaiting{display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px dashed var(--g-200);border-radius:12px;background:var(--g-50)}
.hr-member-shell .order-awaiting>span,.hr-member-shell .orders-empty>span{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;background:var(--g-100);color:var(--g-700);font-weight:800}
.hr-member-shell .order-awaiting>div{display:grid;gap:3px}
.hr-member-shell .order-awaiting strong{color:var(--ink-2);font-size:13px}
.hr-member-shell .order-awaiting small{font-size:12px}
.hr-member-shell .orders-empty{display:grid;justify-items:center;gap:8px;padding:36px 18px;border:1.5px dashed #c5d6cc;border-radius:16px;background:#fafcfb;text-align:center}
.hr-member-shell .orders-empty>span{width:46px;height:46px;font-size:24px}
.hr-member-shell .orders-empty strong{color:var(--ink-2);font-size:15px}
.hr-member-shell .orders-empty p{margin:0;max-width:360px;font-size:13px;line-height:1.7}
.hr-member-shell .worker-case{padding:14px 0}
.hr-member-shell .worker-case+.worker-case{border-top:1px solid var(--line-soft)}
.hr-member-shell .worker-case h3{margin:2px 0 14px;font-size:15px;font-weight:800;color:var(--ink)}
.hr-member-shell .worker-case>strong{color:var(--ink)}
.hr-member-shell .worker-case>p{margin:6px 0 0;font-size:13.5px;line-height:1.65}
.hr-member-shell .document-item{padding:15px 16px;margin-top:10px;border:1px solid var(--line);border-radius:14px;background:#fff;transition:border-color .16s,box-shadow .16s}
.hr-member-shell .document-item:hover{border-color:var(--g-200);box-shadow:var(--shadow-sm)}
.hr-member-shell .document-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.hr-member-shell .document-heading strong{display:block;color:var(--ink);font-size:15px}
.hr-member-shell .document-heading small{display:block;margin-top:4px;color:var(--ink-3);font-size:12.5px;line-height:1.5}
.hr-member-shell .doc-status{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:#eef2ef;color:#56655d;font-size:12px;font-weight:800;white-space:nowrap}
.hr-member-shell .doc-status::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.hr-member-shell .doc-missing{background:#eef2ef;color:#56655d}
.hr-member-shell .doc-submitted{background:var(--amber-bg);color:var(--amber)}
.hr-member-shell .doc-approved{background:var(--g-100);color:var(--g-700)}
.hr-member-shell .doc-returned{background:var(--red-bg);color:var(--red)}
.hr-member-shell .doc-na{background:#f1f3f2;color:#8a958f}
.hr-member-shell .return-note{margin:10px 0 0;padding:10px 13px;border-radius:10px;background:var(--red-bg);color:var(--red)!important;font-size:13px;font-weight:600;line-height:1.6}
.hr-member-shell .document-history{display:grid;gap:6px;margin:12px 0 0}
.hr-member-shell .document-history>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:9px 12px;border-radius:9px;background:#f6f9f7;color:var(--ink-2);font-size:12.5px}
.hr-member-shell .document-history>div span:first-child{margin-right:auto;font-weight:600}
.hr-member-shell .document-history a{color:var(--g-700);font-weight:800;text-decoration:none}
.hr-member-shell .document-history a:hover{text-decoration:underline}
.hr-member-shell .document-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.hr-member-shell .document-actions:empty{display:none}
.hr-member-shell .document-history details>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:6px;padding:9px 12px;border-radius:9px;background:#f6f9f7;color:var(--ink-2);font-size:12.5px}
.hr-member-shell .document-history details>div span:first-child{margin-right:auto;font-weight:600}
.hr-member-shell .document-history details>div a{color:var(--g-700);font-weight:800;text-decoration:none}
.hr-member-shell .document-history-older>summary{display:inline-flex;align-items:center;min-height:36px;padding:4px 2px;color:var(--g-700);font-size:12.5px;font-weight:800;cursor:pointer;list-style:none}
.hr-member-shell .document-history-older>summary::-webkit-details-marker,.hr-member-shell .upload-toggle>summary::-webkit-details-marker,.hr-member-shell .doc-group>summary::-webkit-details-marker{display:none}
.hr-member-shell .document-history-older>summary::before{content:'+';margin-right:6px}
.hr-member-shell .document-history-older[open]>summary::before{content:'−'}
.hr-member-shell .upload-toggle{margin-top:10px}
.hr-member-shell .upload-toggle>summary{display:inline-flex;align-items:center;min-height:42px;padding:8px 16px;border:1px solid var(--g-200);border-radius:11px;background:var(--g-50);color:var(--g-700);font-size:13.5px;font-weight:800;cursor:pointer;list-style:none}
.hr-member-shell .upload-toggle[open]>summary{background:var(--g-100)}
.hr-member-shell .upload-toggle .upload-row{margin-top:8px}
.hr-member-shell .upload-toggle-quiet{margin-top:2px}
.hr-member-shell .upload-toggle-quiet>summary{min-height:36px;padding:4px 2px;border:0;border-radius:0;background:none;color:var(--g-700);font-size:12.5px}
.hr-member-shell .upload-toggle-quiet[open]>summary{background:none}
.hr-member-shell .upload-toggle-quiet>summary::before{content:'+';margin-right:6px}
.hr-member-shell .upload-toggle-quiet[open]>summary::before{content:'−'}
.hr-member-shell .doc-filter-bar{display:flex;gap:8px;margin:0 -2px;padding:2px 2px 12px;overflow-x:auto;scrollbar-width:none}
.hr-member-shell .doc-filter-bar::-webkit-scrollbar{display:none}
.hr-member-shell button.doc-filter{flex:none;min-height:42px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink-2);font-size:13.5px;box-shadow:none}
.hr-member-shell button.doc-filter b{min-width:20px;padding:1px 6px;border-radius:999px;background:var(--g-100);color:var(--g-700);font-size:12px;text-align:center;font-variant-numeric:tabular-nums}
.hr-member-shell button.doc-filter:hover:not(:disabled){background:var(--g-50);border-color:var(--g-200);color:var(--g-700);transform:none;box-shadow:none;filter:none}
.hr-member-shell button.doc-filter.is-active,.hr-member-shell button.doc-filter.is-active:hover:not(:disabled){border-color:var(--g-700);background:var(--g-700);color:#fff}
.hr-member-shell button.doc-filter.is-active b{background:rgba(255,255,255,.22);color:#fff}
.hr-member-shell .doc-search{display:block;margin:0 0 12px}
.hr-member-shell .doc-search input[type=search]{width:100%;box-sizing:border-box}
.hr-member-shell .doc-worker{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
.hr-member-shell .doc-worker+.doc-worker{margin-top:10px}
.hr-member-shell button.doc-worker-toggle{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"name progress chevron" "badges badges badges";align-items:center;gap:8px 10px;width:100%;min-height:56px;padding:12px 14px;border:0;border-radius:0;background:transparent;color:var(--ink);font:inherit;text-align:left;box-shadow:none}
.hr-member-shell button.doc-worker-toggle:hover:not(:disabled){background:var(--g-50);transform:none;box-shadow:none;filter:none}
.hr-member-shell .doc-worker-name{grid-area:name;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:800}
.hr-member-shell .doc-worker-progress{grid-area:progress;color:var(--ink-3);font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.hr-member-shell .doc-worker-chevron{grid-area:chevron;color:var(--ink-3);transition:transform .2s}
.hr-member-shell button.doc-worker-toggle[aria-expanded=true] .doc-worker-chevron{transform:rotate(180deg)}
.hr-member-shell .doc-worker-badges{grid-area:badges;display:flex;flex-wrap:wrap;gap:6px}
.hr-member-shell .doc-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:#eef2ef;color:#56655d;font-size:12px;font-weight:800}
.hr-member-shell .doc-badge b{font-variant-numeric:tabular-nums}
.hr-member-shell .doc-badge-submitted{background:var(--amber-bg);color:var(--amber)}
.hr-member-shell .doc-badge-returned{background:var(--red-bg);color:var(--red)}
.hr-member-shell .doc-badge-done{background:var(--g-100);color:var(--g-700)}
.hr-member-shell .doc-worker-body{padding:2px 12px 14px;border-top:1px solid var(--line-soft)}
.hr-member-shell .doc-group{margin-top:12px}
.hr-member-shell .doc-group>h4{display:flex;align-items:center;gap:8px;margin:0;color:var(--ink-2);font-size:13px}
.hr-member-shell .doc-group>h4 b,.hr-member-shell .doc-group>summary b{padding:1px 8px;border-radius:999px;background:var(--line-soft);font-size:12px;font-variant-numeric:tabular-nums}
.hr-member-shell .doc-group>summary{display:flex;align-items:center;gap:8px;min-height:42px;padding:6px 2px;color:var(--ink-2);font-size:13px;font-weight:800;cursor:pointer;list-style:none}
.hr-member-shell .doc-group>summary svg{margin-left:auto;transition:transform .2s}
.hr-member-shell .doc-group[open]>summary svg{transform:rotate(180deg)}
.hr-member-shell .doc-review-empty{margin:8px 0 0;padding:20px;border:1px dashed var(--line);border-radius:14px;text-align:center;color:var(--ink-3);font-size:14px}
.hr-member-shell .process-row,.hr-member-shell .progress-step{display:grid;grid-template-columns:minmax(140px,1.2fr) repeat(2,minmax(130px,1fr)) minmax(120px,1fr) auto;align-items:end;gap:10px;padding:13px 15px;margin-top:10px;border:1px solid var(--line-soft);border-radius:14px;background:#fcfdfc}
.hr-member-shell .process-row strong,.hr-member-shell .progress-step strong{align-self:center;color:var(--ink);font-size:14px}
.hr-member-shell .process-row label,.hr-member-shell .progress-step label{font-size:12px;font-weight:700}
.hr-member-shell .process-row button,.hr-member-shell .progress-step button{min-height:42px;padding:9px 16px}
.hr-member-shell .progress-document-list{display:grid;gap:8px;padding:0;margin:0;list-style:none}
.hr-member-shell .progress-document-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;margin:0;border:1px solid var(--line-soft);border-radius:11px;background:#fcfdfc;color:var(--ink-2);font-weight:600}
.hr-member-shell .progress-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(9,28,20,.52);backdrop-filter:blur(6px);animation:hr-portal-fade .2s ease both}
.hr-member-shell .progress-modal{display:flex;flex-direction:column;width:min(920px,100%);max-height:min(90vh,920px);overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.8);border-radius:24px;box-shadow:0 30px 90px rgba(5,25,17,.32);animation:hr-portal-rise .28s cubic-bezier(.2,.8,.2,1) both}
.hr-member-shell .delete-worker-modal,.hr-member-shell .review-document-modal{width:min(520px,100%)}
.hr-member-shell .progress-modal-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 26px;border-bottom:1px solid var(--line-soft);background:linear-gradient(110deg,var(--g-50),#fff)}
.hr-member-shell .progress-modal-header span{color:var(--g-600);font-size:11.5px;font-weight:800;letter-spacing:.14em}
.hr-member-shell .progress-modal-header h2{margin:5px 0 0;color:var(--ink);font-size:20px;font-weight:800;line-height:1.35}
.hr-member-shell .progress-modal-body{overflow:auto;padding:22px 26px}
.hr-member-shell .worker-edit-form{padding:22px 26px 26px;overflow:auto;align-content:start}
.hr-member-shell .worker-edit-actions,.hr-member-shell .profile-modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;grid-column:1/-1;flex-wrap:wrap}
.hr-member-shell .worker-edit-actions{position:sticky;bottom:-26px;margin:0 -26px -26px;padding:14px 26px;border-top:1px solid var(--line-soft);background:rgba(255,255,255,.94);backdrop-filter:blur(8px)}
.hr-member-shell .progress-modal-body .worker-edit-actions{position:static;margin:16px 0 0;padding:0;border:0;background:none;backdrop-filter:none}
.hr-member-shell .delete-worker-error{margin:0 0 14px;color:var(--red)!important;font-weight:700;line-height:1.7}
.hr-member-shell .progress-modal-case{margin-top:20px;padding-top:16px;border-top:1px solid var(--line-soft)}
.hr-member-shell .progress-modal-case h3{margin:0 0 14px;color:var(--ink);font-size:16px;font-weight:800}
.hr-member-shell .progress-modal-case h4{display:flex;align-items:center;gap:9px;margin:20px 0 10px;color:var(--g-700);font-size:14px;font-weight:800}
.hr-member-shell .progress-modal-case h4::before{content:'';width:4px;height:14px;border-radius:4px;background:linear-gradient(var(--g-500),var(--g-700))}
.hr-member-shell .profile-notes{margin-top:18px;padding:14px 16px;border:1px solid var(--line-soft);border-radius:13px;background:var(--g-50)}
.hr-member-shell .profile-notes strong{color:var(--g-700)}
.hr-member-shell .profile-notes p{margin:6px 0 0;white-space:pre-wrap;color:var(--ink-2)!important}
.hr-member-shell .return-document-form{display:grid;gap:12px}
.hr-member-shell .return-document-form>p{margin:0;color:var(--ink-2);line-height:1.7}
.hr-member-shell.hr-member-registration .application-header{background:rgba(255,255,255,.88);color:var(--ink);box-shadow:var(--shadow-sm)}
.hr-member-shell.hr-member-registration .application-header::after{display:none}
.hr-member-shell.hr-member-registration .application-header span{color:var(--g-700)}
.hr-member-shell.hr-member-registration .application-header h1{color:var(--ink)}
.hr-member-shell.hr-member-registration .application-header p{color:var(--ink-3)}
.hr-member-shell.hr-member-registration .application-header button{background:var(--g-100);color:var(--g-700);border-color:transparent}
.hr-member-shell.hr-member-registration .application-header button:hover{background:var(--g-200);transform:none}
.hr-member-shell .hr-member-pending h2::before{display:none}
.hr-member-shell .hr-member-card .application-form-hero>p{color:#e3f2e9}
@media(max-width:900px){.hr-member-shell .resume-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.hr-member-shell{padding:58px 12px 12px}
.hr-member-shell .hr-member-header{padding:18px;border-radius:18px;align-items:flex-start}
.hr-member-shell .hr-member-header .hr-member-avatar{width:44px;height:44px;font-size:18px;border-radius:13px}
.hr-member-shell .hr-member-header button{padding:9px 12px}
.hr-member-shell .workspace-tabs{top:6px;margin-bottom:14px;padding:5px;border-radius:15px}
.hr-member-shell .workspace-tabs button{min-height:42px;padding:8px 14px}
.hr-member-shell .hr-member-card{padding:16px;border-radius:16px}
.hr-member-shell .workspace-basic-fields,.hr-member-shell .worker-form,.hr-member-shell .worker-detail,.hr-member-shell .upload-row,.hr-member-shell .process-row,.hr-member-shell .progress-step,.hr-member-shell .resume-form-grid,.hr-member-shell .resume-experience-row{grid-template-columns:minmax(0,1fr)}
.hr-member-shell .resume-form-grid .resume-field-wide,.hr-member-shell .resume-experience-row .resume-field-wide{grid-column:auto}
.hr-member-shell .resume-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
.hr-member-shell .card-title,.hr-member-shell .orders-heading,.hr-member-shell .resume-profile-header,.hr-member-shell .member-home-heading{flex-direction:column;align-items:flex-start}
.hr-member-shell .resume-profile-header>div:last-child{justify-content:flex-start}
.hr-member-shell .member-home-case-list>article,.hr-member-shell .candidate-card,.hr-member-shell .order-agency-heading{align-items:flex-start;flex-direction:column}
.hr-member-shell .member-home-case-list button{width:100%}
.hr-member-shell .order-agency-heading>span{text-align:left}
.hr-member-shell .candidate-actions{justify-content:flex-start}
.hr-member-shell .job-order-facts{grid-template-columns:1fr;gap:8px}
.hr-member-shell .order-form{padding:14px}
.hr-member-shell .process-row strong,.hr-member-shell .progress-step strong{padding-top:6px}
.hr-member-shell .progress-modal-backdrop{padding:0;align-items:end}
.hr-member-shell .progress-modal{width:100%;max-height:93vh;border-radius:22px 22px 0 0}
.hr-member-shell .progress-modal-header,.hr-member-shell .progress-modal-body{padding-left:18px;padding-right:18px}
.hr-member-shell .worker-edit-form{padding:18px}
.hr-member-shell .worker-edit-actions{bottom:-18px;margin:0 -18px -18px;padding:12px 18px}
.hr-member-shell label.resume-language-level{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.hr-member-shell .hr-member-header,.hr-member-shell .hr-member-card,.hr-member-shell .progress-modal,.hr-member-shell .progress-modal-backdrop{animation:none}
.hr-member-shell .hr-member-card button,.hr-member-shell .workspace-tabs button,.hr-member-shell .member-home-metrics article{transition:none}}
/* ===== 工人階段文件 ===== */
.hr-member-shell .stage-overall{display:grid;gap:8px;margin:0 0 16px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(120deg,var(--g-50),#fff)}
.hr-member-shell .stage-overall>div{display:flex;justify-content:space-between;gap:12px;color:var(--ink-2);font-size:13px}
.hr-member-shell .stage-overall strong{font-weight:800;color:var(--ink)}
.hr-member-shell .stage-overall span{font-weight:800;color:var(--g-700);font-variant-numeric:tabular-nums}
.hr-member-shell .stage-overall progress{width:100%;height:9px;border:0;border-radius:99px;overflow:hidden;background:var(--line-soft);accent-color:var(--g-600)}
.hr-member-shell .stage-overall progress::-webkit-progress-bar{background:var(--line-soft);border-radius:99px}
.hr-member-shell .stage-overall progress::-webkit-progress-value{background:linear-gradient(90deg,var(--g-600),var(--g-500));border-radius:99px}
.hr-member-shell .stage-overall progress::-moz-progress-bar{background:linear-gradient(90deg,var(--g-600),var(--g-500));border-radius:99px}
.hr-member-shell .stage-list{display:grid;gap:12px}
.hr-member-shell .stage-card{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden;transition:border-color .16s,box-shadow .16s}
.hr-member-shell .stage-card.stage-current{border-color:#9fd3b9;box-shadow:0 0 0 3px rgba(31,131,102,.1)}
.hr-member-shell button.stage-toggle{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:14px 16px;border:0;border-radius:0;background:transparent;color:var(--ink);font:inherit;text-align:left;box-shadow:none}
.hr-member-shell button.stage-toggle:hover:not(:disabled){background:var(--g-50);transform:none;box-shadow:none;filter:none}
.hr-member-shell .stage-badge{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;background:var(--g-100);color:var(--g-700);font-size:15px;font-weight:800}
.hr-member-shell .stage-current .stage-badge{background:linear-gradient(135deg,var(--g-700),var(--g-500));color:#fff}
.hr-member-shell .stage-done .stage-badge{background:var(--g-700);color:#fff}
.hr-member-shell .stage-heading{display:grid;gap:2px;flex:1;min-width:0}
.hr-member-shell .stage-heading strong{font-size:15px;font-weight:800;color:var(--ink)}
.hr-member-shell .stage-heading small{color:var(--ink-3);font-size:12px;font-weight:500;line-height:1.5}
.hr-member-shell .stage-current-tag{flex:none;padding:4px 10px;border-radius:999px;background:var(--g-100);color:var(--g-700);font-size:12px;font-weight:800}
.hr-member-shell .stage-count{flex:none;color:var(--ink-3);font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.hr-member-shell .stage-chevron{flex:none;color:var(--ink-3);transition:transform .2s}
.hr-member-shell button.stage-toggle[aria-expanded=true] .stage-chevron{transform:rotate(180deg)}
.hr-member-shell .stage-body{padding:4px 16px 18px;border-top:1px solid var(--line-soft)}
.hr-member-shell .stage-summary{margin:12px 0 0;color:var(--ink-3);font-size:13.5px;line-height:1.65}
.hr-member-shell .stage-section{margin-top:16px}
.hr-member-shell .stage-section>h4{display:flex;align-items:center;gap:8px;margin:0 0 4px;color:var(--g-700);font-size:13px;font-weight:800;letter-spacing:.04em}
.hr-member-shell .stage-section>h4::before{content:'';width:4px;height:13px;border-radius:4px;background:linear-gradient(var(--g-500),var(--g-700))}
.hr-member-shell .stage-step{display:flex;align-items:center;gap:12px;padding:11px 14px;margin-top:8px;border:1px solid var(--line-soft);border-radius:12px;background:#fcfdfc}
.hr-member-shell .stage-step>div{display:grid;gap:2px;flex:1;min-width:0}
.hr-member-shell .stage-step strong{color:var(--ink);font-size:14px}
.hr-member-shell .stage-step small{color:var(--ink-3);font-size:12px}
.hr-member-shell .stage-step time,.hr-member-shell .stage-ack-done time{color:var(--ink-3);font-size:12px;font-variant-numeric:tabular-nums}
.hr-member-shell .stage-ack{display:grid;gap:10px;padding:13px 14px;margin-top:8px;border:1px solid var(--line);border-radius:13px;background:#fff}
.hr-member-shell .stage-ack.is-confirmed{border-color:#bfe3d0;background:var(--g-50)}
.hr-member-shell .stage-ack>p{margin:0;color:var(--ink-2)!important;font-size:13.5px;line-height:1.7}
.hr-member-shell .stage-ack>button{justify-self:start}
.hr-member-shell .stage-ack-done{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hr-member-shell .stage-ack-check{display:inline-flex;align-items:center;gap:6px;color:var(--g-700);font-size:13px;font-weight:800}
.hr-member-shell .stage-tips{display:grid;gap:8px;margin:8px 0 0;padding:0;list-style:none}
.hr-member-shell .stage-tips li{display:flex;align-items:flex-start;gap:8px;padding:10px 13px;margin:0;border:1px solid #f1deb0;border-radius:11px;background:var(--amber-bg);color:#6b4a0c;font-size:13px;line-height:1.65}
.hr-member-shell .stage-tips li>span:first-child{flex:1}
.hr-member-shell .stage-info{display:grid;gap:3px;padding:12px 14px;margin-top:8px;border:1px solid var(--line-soft);border-radius:12px;background:#fcfdfc}
.hr-member-shell .stage-info strong{color:var(--ink);font-size:13.5px}
.hr-member-shell .stage-info p{margin:0;color:var(--ink-2)!important;font-size:13.5px;line-height:1.7}
.hr-member-shell .stage-empty{margin:14px 0 0;color:var(--ink-3);font-size:13px}
.hr-member-shell .stage-footnotes{margin-top:22px;padding-top:16px;border-top:1px solid var(--line-soft)}
.hr-member-shell .stage-footnotes h3{margin:14px 0 6px;font-size:14px;font-weight:800}
.hr-member-shell .stage-notice{margin:0;font-size:12.5px;line-height:1.75}
.hr-member-shell .document-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:10px;color:var(--ink-2);font-size:12.5px}
.hr-member-shell .document-meta em{margin-right:6px;color:var(--ink-3);font-style:normal;font-weight:700}
.hr-member-shell .document-meta p{flex-basis:100%;margin:2px 0 0;color:var(--ink-3)!important;font-size:12.5px}
.hr-member-shell .guide-tag{flex:none;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.02em}
.hr-member-shell .tag-estimate{background:var(--amber-bg);color:var(--amber)}
.hr-member-shell .tag-verified{background:var(--g-100);color:var(--g-700)}
@media(max-width:700px){
.hr-member-shell .stage-body{padding:4px 12px 16px}
.hr-member-shell .doc-filter-bar{overflow:visible;gap:6px}
.hr-member-shell button.doc-filter{flex:1 1 0;flex-wrap:wrap;min-width:0;justify-content:center;gap:2px 4px;padding:8px 3px;font-size:12.5px}
.hr-member-shell button.doc-filter span{white-space:nowrap}
.hr-member-shell button.doc-filter b{min-width:0;padding:1px 5px;font-size:11px}
.hr-member-shell .doc-worker-body{padding:0 10px 12px}
.hr-member-shell .doc-worker-body .document-item{padding:12px;margin-top:8px;border-radius:12px}
.hr-member-shell .document-item .document-heading strong{font-size:14px}
.hr-member-shell .document-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.hr-member-shell .document-actions .table-action{min-height:42px}
.hr-member-shell button.stage-toggle{padding:12px;gap:10px}
.hr-member-shell .stage-current-tag{display:none}
.hr-member-shell .stage-step{flex-wrap:wrap}
}
    `}</style>;
}

export default function HrMemberPortal({ actor }) {
  const { lang, setLang } = useLanguage();
  const [activeWorkspaceTab,setActiveWorkspaceTab]=useState('start');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [operationMessage,setOperationMessage]=useState('');
  const [returnDocument,setReturnDocument]=useState(null);
  const [returnReason,setReturnReason]=useState('');
  const [returnError,setReturnError]=useState('');
  const [reviewSaving,setReviewSaving]=useState(false);
  const [requestedRole, setRequestedRole] = useState('worker');
  const [requestedAgencyId, setRequestedAgencyId] = useState('');
  const [requestedAgencyType, setRequestedAgencyType] = useState('taiwan');
  const [requesting, setRequesting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [progressWorker, setProgressWorker] = useState(null);
  const [profileWorker, setProfileWorker] = useState(null);
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [deleteWorkerError, setDeleteWorkerError] = useState('');
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerEditorOpen, setWorkerEditorOpen] = useState(false);
  const [photoCropFile, setPhotoCropFile] = useState(null);
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
  const [uploading, setUploading] = useState(false);
  const [stepSaving, setStepSaving] = useState('');
  const [orderForm,setOrderForm]=useState({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});
  const [orderEditForm,setOrderEditForm]=useState({jobType:'',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});
  const [orderSubmitting,setOrderSubmitting]=useState(false);
  const [editingOrderId,setEditingOrderId]=useState(null);
  const workerEditorDialogRef=useRef(null);
  const deleteWorkerDialogRef=useRef(null);
  const profileDialogRef=useRef(null);
  const progressDialogRef=useRef(null);
  const reviewDialogRef=useRef(null);
  const handleWorkerEditorKeyDown=useHrDialog(workerEditorDialogRef,()=>{setWorkerEditorOpen(false);setEditingWorker(null)});
  const handleDeleteWorkerKeyDown=useHrDialog(deleteWorkerDialogRef,()=>{setWorkerToDelete(null);setDeleteWorkerError('')});
  const handleProfileKeyDown=useHrDialog(profileDialogRef,()=>setProfileWorker(null));
  const handleProgressKeyDown=useHrDialog(progressDialogRef,()=>setProgressWorker(null));
  const handleReviewDialogKeyDown=useHrDialog(reviewDialogRef,()=>{setReturnDocument(null);setReturnError('')});
  useEffect(() => {
    let active = true;
    fetch('/api/hr', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '無法讀取會員資料');
      if (active) setData(body);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (data?.role !== 'pending' || !data.pendingApproval || !data.requestedRole) return;
    setRequestedRole(data.requestedRole);
    setRequestedAgencyId(String(data.requestedAgencyId || ''));
    if (data.requestedAgencyType) setRequestedAgencyType(data.requestedAgencyType);
  }, [data?.role, data?.pendingApproval, data?.requestedRole, data?.requestedAgencyId, data?.requestedAgencyType]);

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
    setResumeImporting(true);
    try{
      const {topLevel,parsed,importedPhoto}=await parseResumePdf(file);
      setWorkerForm(current=>({...current,...topLevel,resumeProfile:{...current.resumeProfile,...parsed}}));
      if(importedPhoto)setPhotoCropFile(importedPhoto);
      setResumeImportMessage(importedPhoto?'已讀取履歷文字並自動擷取照片；請檢查資料與照片後再儲存。':'已讀取履歷文字並填入可辨識欄位；未找到可用照片，請確認並手動上傳。');
    }catch(error){setResumeImportMessage(error.message||'無法讀取此 PDF，請確認檔案未加密且格式正確。');}
    finally{setResumeImporting(false);input.value='';}
  }
  function uploadWorkerPhoto(event) {
    const input=event.currentTarget,file=input.files?.[0];if(!file)return;
    if(!['image/jpeg','image/png'].includes(file.type)||file.size>1500000){setError('履歷照片請使用 JPG 或 PNG，檔案需小於 1.5 MB。');input.value='';return;}
    setError('');
    setPhotoCropFile(file);
    input.value='';
  }
  async function downloadWorkerResume(worker) {
    setResumePdfLoading(true);
    try {let photoDataUrl='';if(worker?.id){const response=await fetch(`/api/hr/workers/${worker.id}/resume-photo`,{cache:'no-store'});if(response.ok)photoDataUrl=(await response.json()).photoDataUrl||'';}await createWorkerResumePdf({...worker,resume_profile:{...(worker.resume_profile||{}),photoDataUrl}},lang);}
    catch (err) { setError(err.message||'履歷 PDF 產生失敗。'); }
    finally { setResumePdfLoading(false); }
  }
  function beginEmployerEdit(item) {
    setEditingEmployer(item);
    setEmployerForm({ name:item.name||'', employerType:item.employer_type||'other', contactName:item.contact_name||'', phone:item.phone||'', email:item.email||'', address:item.address||'', notes:item.notes||'' });
  }
  async function saveEmployer(event) {
    event.preventDefault(); setEmployerSaving(true); setError('');
    try {
      const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'employer',id:editingEmployer.id,...employerForm})});
      const body=await response.json(); if(!response.ok)throw new Error(body.error||'儲存雇主資料失敗');
      setEditingEmployer(null); setOperationMessage('雇主資料已更新。'); await refresh();
    } catch(err){setError(err.message);} finally{setEmployerSaving(false);}
  }
  async function saveWorker(event) {
    event.preventDefault(); setWorkerSaving(true); setError('');
    try {
      const response = await fetch('/api/hr', { method: editingWorker ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'worker', ...(editingWorker ? {id:editingWorker.id} : {}), ...workerForm }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '儲存工作者資料失敗');
      setResumeViewPhoto(workerForm.resumeProfile.photoDataUrl||'');
      setOperationMessage(editingWorker?'工作者資料已更新。':'已新增工作者。');
      setEditingWorker(null); setWorkerEditorOpen(false); await refresh();
    } catch (err) { setError(err.message); } finally { setWorkerSaving(false); }
  }
  async function toggleWorker(item) {
    const response = await fetch('/api/hr', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'worker',id:item.id,active:item.status!=='active'}) });
    const body = await response.json(); if (!response.ok) { setError(body.error || '更新工作者狀態失敗'); return; } setOperationMessage('工作者狀態已更新。'); await refresh();
  }
  async function deleteWorker(item) {
    setWorkerToDelete(item);
    setDeleteWorkerError('');
  }
  async function confirmDeleteWorker() {
    if (!workerToDelete) return;
    try {
      const response=await fetch(`/api/hr?id=${workerToDelete.id}`,{method:'DELETE'}); const body=await response.json();
      if (!response.ok) { setDeleteWorkerError(body.error || '移除工人失敗'); return; }
      setWorkerToDelete(null); setDeleteWorkerError(''); setError(''); setOperationMessage('已從仲介移除工作者。'); await refresh();
    } catch { setDeleteWorkerError('移除失敗，請確認網路連線後再試。'); }
  }
  async function uploadDocument(event, requirement) {
    event.preventDefault(); const formElement=event.currentTarget; setUploading(true); setError('');
    try {
      const form = new FormData(formElement); form.set('requirementId',String(requirement.id));
      const response = await fetch('/api/hr/documents',{method:'POST',body:form}); const body=await response.json();
      if (!response.ok) throw new Error(body.error || '文件上傳失敗');
      formElement.reset(); setOperationMessage('文件已上傳，已送交審核。'); await refresh();
    } catch(err) { setError(err.message); } finally { setUploading(false); }
  }
  async function acknowledge(caseId, key, confirmed) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'worker-acknowledge',caseId,key,confirmed})});
    const body=await response.json().catch(()=>({})); if(!response.ok){setError(body.error||'確認失敗');return;} await refresh();
  }
  async function setApplicability(requirement) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'requirement-applicability',requirementId:requirement.id,applicable:!requirement.applicable})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新文件適用狀態失敗');return;} setOperationMessage('文件適用狀態已更新。'); await refresh();
  }
  async function reviewDocument(requirement, decision) {
    if(decision==='returned'){
      setReturnDocument(requirement);
      setReturnReason('');
      setReturnError('');
      return;
    }
    await submitDocumentReview(requirement,decision,'');
  }
  async function submitDocumentReview(requirement,decision,reason) {
    setReviewSaving(true);
    try {
      const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'review',submissionId:requirement.latest_submission_id,decision,reason})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'文件審核失敗');
      setReturnDocument(null);setReturnReason('');setReturnError('');
      setOperationMessage(decision==='returned'?'已退回文件並通知工作者補件。':'文件已核准。');
      await refresh();
    } catch(err) {
      if(decision==='returned')setReturnError(err.message);
      else setError(err.message);
    } finally {setReviewSaving(false);}
  }
  async function submitDocumentReturn(event) {
    event.preventDefault();
    const reason=returnReason.trim();
    if(!reason){setReturnError('請填寫補件原因。');return;}
    await submitDocumentReview(returnDocument,'returned',reason);
  }
  async function saveApplicationStep(event, step) {
    event.preventDefault(); const form=new FormData(event.currentTarget);setStepSaving(`${step.case_id}:${step.step_key}`);setError('');
    try {const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'application-step',caseId:step.case_id,stepKey:step.step_key,startedOn:form.get('startedOn'),completedOn:form.get('completedOn'),note:form.get('note')})});const body=await response.json();if(!response.ok)throw new Error(body.error||'儲存申請程序失敗');setOperationMessage('申請程序已儲存。');await refresh();}
    catch(err){setError(err.message);}finally{setStepSaving('');}
  }
  async function updateCaseStatus(item,status) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'case',id:item.id,status,expectedStartDate:item.expected_start_date?String(item.expected_start_date).slice(0,10):'',notes:item.notes||''})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新案件狀態失敗');return;} setOperationMessage('案件狀態已更新。'); await refresh();
  }
  async function submitWorkflow(payload, successMessage='', method='POST') {
    setError('');setOperationMessage('');try{const response=await fetch('/api/hr',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.error||'送出失敗');if(successMessage)setOperationMessage(successMessage);else if(payload.type==='job-order')setOperationMessage('需求單已建立並送交所屬仲介。');else if(payload.type==='job-order-update')setOperationMessage('需求單已更新。');else if(payload.type==='job-order-candidate'||payload.type==='job-order-employer-candidate')setOperationMessage('已送出推薦人選。');await refresh();return body;}catch(err){setError(err.message);return null;}
  }
  function editOrder(order){const dispatch=data.orderAgencies.find(item=>Number(item.job_order_id)===Number(order.id));setOrderEditForm({jobType:order.job_type,headcount:order.headcount,description:order.description||'',expectedStartDate:order.expected_start_date?String(order.expected_start_date).slice(0,10):'',brokerMemberId:dispatch?.broker_member_id?String(dispatch.broker_member_id):''});setEditingOrderId(Number(order.id));}
  function cancelOrderEdit(){setEditingOrderId(null);}
  async function submitOrder(event){event.preventDefault();const agencyId=data.employers[0]?.agency_id;if(!agencyId)return;setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order',jobType:orderForm.jobType,headcount:Number(orderForm.headcount),description:orderForm.description,expectedStartDate:orderForm.expectedStartDate,taiwanAgencyAssignments:[{agencyId,brokerMemberId:orderForm.brokerMemberId||null}]});if(result)setOrderForm({jobType:'家庭看護',headcount:1,description:'',expectedStartDate:'',brokerMemberId:''});setOrderSubmitting(false);}
  async function submitOrderEdit(event,order){event.preventDefault();setOrderSubmitting(true);const result=await submitWorkflow({type:'job-order-update',id:order.id,...orderEditForm,headcount:Number(orderEditForm.headcount)},'', 'PATCH');if(result)cancelOrderEdit();setOrderSubmitting(false);}
  async function deleteOrder(order){if(!window.confirm(`確定刪除需求單 #${order.id}？刪除後無法復原。`))return;setError('');try{const response=await fetch(`/api/hr?id=${order.id}&type=job-order`,{method:'DELETE'});const body=await response.json();if(!response.ok)throw new Error(body.error||'刪除需求單失敗');if(Number(editingOrderId)===Number(order.id))cancelOrderEdit();setOperationMessage('已刪除需求單。');await refresh();}catch(err){setError(err.message);}}
  async function selectOrderWorker(order,worker){await submitWorkflow({type:'job-order-employer-candidate',orderId:order.id,workerId:worker.id});}
  async function interviewDecision(candidate,status){const confirmText=status==='passed'?'確認錄用並建立正式申辦案件？':status==='rejected'?'確認未錄用此人選？':'安排此人選面試？';if(!window.confirm(confirmText))return;const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'job-order-candidate-interview',candidateId:candidate.id,status})});const body=await response.json();if(!response.ok){setError(body.error||'更新面試結果失敗');return;}setError('');setOperationMessage('面試狀態已更新。');await refresh();}

  if (error && !data) return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><PortalStyles /><section className="hr-member-card"><span>克雷迅人力管理</span><h1>無法載入會員資料</h1><p>{error}</p><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></section></main>;
  if (!data) return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><PortalStyles /><section className="hr-member-card"><span>克雷迅人力管理</span><h1>載入中</h1><p>正在確認此帳號可存取的案件資料。</p></section></main>;

  if (data.role === 'pending') {
    const roles = { worker: '工作者', employer: '雇主', agency: '仲介', training_center: '訓練中心' };
    const agencyTypes = { taiwan: '台灣仲介', philippines: '菲律賓仲介' };
    const needsAgency = requestedRole !== 'training_center';
    const requestedAgencies = needsAgency ? data.agencies.filter(item => item.active && (
      requestedRole === 'worker' ? item.agency_type === 'philippines'
        : requestedRole === 'employer' ? item.agency_type === 'taiwan'
          : item.agency_type === requestedAgencyType
    )) : [];
    const agencyName = data.agencies.find(item => Number(item.id) === Number(data.requestedAgencyId))?.name || data.requestedAgencyName;
    const currentAgency = () => data.agencies.find(item => Number(item.id) === Number(requestedAgencyId));
    async function requestMembership(event) {
      event.preventDefault();
      setRequesting(true);
      setError('');
      try {
        const response = await fetch('/api/hr/member-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestedRole, requestedAgencyId: needsAgency ? requestedAgencyId : null }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '申請送出失敗');
        const selectedAgency=currentAgency();
        setData(current => ({ ...current, pendingApproval: true, requestedRole: body.requestedRole, requestedAgencyId: body.requestedAgencyId, requestedAgencyName: selectedAgency?.name || null, requestedAgencyType: selectedAgency?.agency_type || null }));
        // 送出成功的明確回饋：顯示提示條，並把畫面捲回最上面（手機上否則看不到畫面已經換成審核進度）。
        setRequestSubmitted(true);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { setError(err.message); }
      finally { setRequesting(false); }
    }
    return <main className="hr-member-shell hr-member-registration" data-hr-translatable-root><HrLanguageTools /><PortalStyles /><header className="hr-member-header application-header"><div><span>克雷迅人力管理</span><h1>會員類型審核</h1><p>{data.actor?.name || actor.name} · 尚未指派會員類型</p></div><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></header><section className="hr-member-card hr-member-pending">
      {data.requestedRole ? <div className="application-review">
        {requestSubmitted&&<p role="status" aria-live="polite" className="hr-request-success application-submit-success"><span aria-hidden="true">✓ </span>送出成功！你的{roles[data.requestedRole]||''}會員申請已送交管理團隊，審核完成後會開通你的工作區。</p>}
        <div className="application-review-heading">
          <div className="application-review-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div>
          <div><span className="application-review-eyebrow">會員申請進度</span><span className="application-review-badge">審核中</span></div>
          <h2>申請已送出，等待管理者審核</h2>
          <p>申請資料已送交管理團隊，我們會在完成審核後更新你的會員權限。</p>
        </div>
        <ol className="application-review-steps" aria-label="會員申請審核進度">
          <li className="application-review-step-done"><span aria-hidden="true">✓</span><div><strong>申請已送出</strong><small>資料已成功提交</small></div></li>
          <li className="application-review-step-current" aria-current="step"><span aria-hidden="true">2</span><div><strong>管理者審核中</strong><small>確認會員類型及所屬仲介</small></div></li>
          <li><span aria-hidden="true">3</span><div><strong>開通會員工作區</strong><small>核准後即可使用對應功能</small></div></li>
        </ol>
        <div className="application-review-details">
          <div><span>申請類型</span><strong>{roles[data.requestedRole] || '尚未選擇'}</strong></div>
          {data.requestedRole !== 'training_center' && <div><span>所屬仲介</span><strong>{agencyTypes[data.requestedAgencyType] || ''}{agencyName ? ` · ${agencyName}` : '尚未選擇'}</strong></div>}
        </div>
        <p className="application-review-note">管理者核准並指派所屬資料後，你就能使用對應的會員工作區。</p>
        <button type="button" disabled={requesting} onClick={() => void refresh()}>重新確認審核狀態</button>
      </div> : <div className="application-form-card">
        <div className="application-form-hero">
          <span className="application-form-kicker">WELCOME TO KOLECION HR</span>
          <h2>開始設定你的會員帳號</h2>
          <p>選擇最符合你的會員類型與所屬仲介，送出後由管理者為你審核開通。</p>
          <ol className="application-form-steps">
            <li className="is-current"><span>1</span>填寫申請</li><li><span>2</span>管理者審核</li><li><span>3</span>開始使用</li>
          </ol>
        </div>
        <form className="application-form" onSubmit={requestMembership}>
          <div className="application-form-section-title"><span>01</span><div><h3>選擇會員類型</h3><p>請選擇你要申請的身分</p></div></div>
          <label>申請類型
            <select value={requestedRole} onChange={event => { setRequestedRole(event.target.value); setRequestedAgencyId(''); if(event.target.value==='worker')setRequestedAgencyType('philippines');else setRequestedAgencyType('taiwan'); }}>
              <option value="worker">工作者</option><option value="employer">雇主</option><option value="agency">仲介</option><option value="training_center">訓練中心</option>
            </select>
          </label>
          {requestedRole==='agency'&&<label>仲介類型
            <select value={requestedAgencyType} onChange={event=>{setRequestedAgencyType(event.target.value);setRequestedAgencyId('');}}><option value="taiwan">台灣仲介</option><option value="philippines">菲律賓仲介</option></select>
          </label>}
          {needsAgency&&<div className="application-form-section-title application-form-agency-title"><span>02</span><div><h3>選擇所屬仲介</h3><p>你的申請將送交所選仲介確認</p></div></div>}
          {needsAgency&&<label>{requestedRole==='worker'?'所屬菲律賓仲介':requestedRole==='employer'?'所屬台灣仲介':'所屬仲介'}
            <select required value={requestedAgencyId} onChange={event=>setRequestedAgencyId(event.target.value)}><option value="">請選擇仲介</option>{requestedAgencies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>}
          {requestedAgencies.length===0&&needsAgency&&<p role="status" className="application-form-empty">目前沒有可選的啟用仲介，請聯絡管理者。</p>}
          <div className="application-form-notice"><span aria-hidden="true">i</span><p>送出申請後，管理者會審核你的身分。核准前不會開放案件或會員資料。</p></div>
          <button className="application-form-submit" disabled={requesting||(needsAgency&&!requestedAgencyId)}>{requesting ? '送出中…' : '送出審核申請'}<span aria-hidden="true">→</span></button>
        </form>
      </div>}
      {error && <p role="alert" className="hr-request-error">{error}</p>}
    </section></main>;
  }

  if (data.role === 'training_center') {
    return <main className="hr-member-shell" data-hr-translatable-root><HrLanguageTools /><PortalStyles /><header className="hr-member-header"><div><span>克雷迅人力管理</span><h1>訓練中心工作區</h1><p>{actor.name}</p></div><button onClick={() => signOut({ callbackUrl: '/' })}>登出</button></header><section className="hr-member-card"><h2>訓練中心會員</h2><p>此角色不會存取仲介、雇主、工作者或案件資料。請在 LINE 官方帳號輸入「會員類型」查看訓練中心專屬圖文選單。</p></section></main>;
  }

  const viewedWorker = data.role === 'worker' ? data.workers[0] : null;
  const isPhilippinesOperator = data.role === 'agency' && data.agencyType === 'philippines';
  const isTaiwanOperator = data.role === 'agency' && data.agencyType === 'taiwan';
  const canManageCaseProgress = data.role === 'agency';
  const workerCases = viewedWorker ? data.cases.filter(item => Number(item.worker_id) === Number(viewedWorker.id)) : ['agency','employer'].includes(data.role) ? data.cases : [];
  // 必要文件屬於工作者，不需要案件就會存在；案件只多出「必備證照」（例如看護案件的 Caregiving NC2）。
  const workerRequirements = viewedWorker ? data.requirements.filter(item => Number(item.worker_id) === Number(viewedWorker.id)) : data.requirements;
  const documentWorkers = data.workers.filter(person => data.requirements.some(item => Number(item.worker_id) === Number(person.id)));
  const CERTIFICATION_LABELS = { not_started: '未開始', training: '訓練中', assessment: '考照中', obtained: '已取得' };
  async function updateCertification(certification, status) {
    const response=await fetch('/api/hr',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'certification',id:certification.id,status,targetDate:certification.target_date?String(certification.target_date).slice(0,10):'',note:certification.note||''})});
    const body=await response.json(); if(!response.ok){setError(body.error||'更新取證進度失敗');return;} setOperationMessage('取證進度已更新。'); await refresh();
  }
  const renderDocumentItem = (item, guide, compact=false) => {const history=data.submissions.filter(sub=>Number(sub.requirement_id)===Number(item.id));const historyRow=sub=><div key={sub.id}><span>第{sub.version_number}版 · {sub.original_filename}</span><span>{sub.decision==='approved'?'合格':sub.decision==='returned'?`退件：${sub.review_reason||''}`:'審核中'}</span><a href={`/api/hr/documents/${sub.id}?preview=1`} target="_blank" rel="noreferrer">檢視</a></div>;const shownHistory=compact?history.slice(0,1):history;const olderHistory=compact?history.slice(1):[];const uploadForm=item.applicable&&(data.role==='worker'||isPhilippinesOperator)&&<form className="upload-row" onSubmit={event=>uploadDocument(event,item)}><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required/><input name="note" placeholder="補件說明（選填）"/><button disabled={uploading}>{uploading?'上傳中…':item.status==='returned'?'重新上傳':'上傳文件'}</button></form>;return <div className="document-item" key={item.id}><div className="document-heading"><div><strong>{item.name}</strong>{item.entry_gate&&<small>前置文件</small>}{item.applicability&&<small>{item.applicability}</small>}</div><span className={`doc-status doc-${item.applicable?item.status:'na'}`}>{!item.applicable?'不適用':({missing:'待收件',submitted:'待審核',approved:'已合格',returned:'退件待修正'}[item.status]||item.status)}</span></div>{guide&&<DocumentGuideMeta guide={guide} />}{item.review_reason&&item.applicable&&item.status==='returned'&&<p className="return-note">補件原因：{item.review_reason}</p>}{history.length>0&&<div className="document-history">{shownHistory.map(historyRow)}{olderHistory.length>0&&<details className="document-history-older"><summary>查看舊版本</summary>{olderHistory.map(historyRow)}</details>}</div>}{compact&&uploadForm?<details className={`upload-toggle${item.status==='approved'||item.status==='submitted'?' upload-toggle-quiet':''}`}><summary>{item.status==='missing'?'上傳文件':'重新上傳'}</summary>{uploadForm}</details>:uploadForm}{isPhilippinesOperator&&<div className="document-actions">{item.applicability&&<button className="table-action" onClick={()=>setApplicability(item)}>{item.applicable?'標示不適用':'確認適用'}</button>}{item.status==='submitted'&&<><button className="table-action" onClick={()=>reviewDocument(item,'approved')}>核准文件</button><button className="table-action" onClick={()=>reviewDocument(item,'returned')}>退回補件</button></>}</div>}</div>};
  const renderCompactDocument = item => renderDocumentItem(item, undefined, true);
  const canUpdateCertification = data.role === 'agency' || data.role === 'admin';
  const activeTaiwanAgencies=data.agencies.filter(item=>item.active&&item.agency_type==='taiwan');
  return <main className="hr-member-shell" data-hr-translatable-root data-hr-language-profile={isPhilippinesOperator ? 'philippines-agency' : undefined}><HrLanguageTools /><PortalStyles />
    <header className="hr-member-header"><div className="hr-member-header-main"><span className="hr-member-avatar" aria-hidden="true">{String(actor.name||'?').trim().charAt(0)||'?'}</span><div><span>克雷迅人力管理</span><h1>{data.role==='agency'?(data.agencyType==='taiwan'?'業務':'Staff'):(labels[data.role] || data.roleName)}工作區</h1><p>{actor.name}</p></div></div><button onClick={() => signOut({ callbackUrl: '/' })}><LogOut size={16} aria-hidden="true" />登出</button></header>
    <HrReminders onOpenChat={roomId=>{setActiveWorkspaceTab('chat');window.dispatchEvent(new CustomEvent('hr:open-chat-room',{detail:{roomId}}));}} onOpenProgress={workerId=>{const worker=data.workers.find(item=>Number(item.id)===Number(workerId));if(worker)setProgressWorker(worker);}} onOpenProfile={item=>{if(item.type==='worker'){const worker=data.workers.find(row=>Number(row.id)===item.entityId);if(worker&&(data.role==='worker'||Number(worker.agency_id)===Number(data.agencyId)))void beginWorkerEdit(worker);}else if(item.type==='employer'){const employer=data.employers.find(row=>Number(row.id)===item.entityId);if(employer&&(data.role==='employer'||Number(employer.agency_id)===Number(data.agencyId)))beginEmployerEdit(employer);}else if(item.type==='agency'){setActiveWorkspaceTab('basic');}}} />
    <nav className="workspace-tabs" aria-label="工作區分頁">{[['start','工作起點',LayoutDashboard],['home','工作摘要',LayoutDashboard],...(['agency','employer'].includes(data.role)?[['matching','需求與配對',Building2]]:[]),['basic','基本資料',UserRound],['agencyEmployer','仲介／雇主資料',Building2],['documents','必要文件',FileText],['process','來台程序',Route],['chat','聊天室',MessagesSquare]].map(([tab,label,Icon])=><button key={tab} type="button" className={activeWorkspaceTab===tab?'active':''} aria-current={activeWorkspaceTab===tab?'page':undefined} onClick={()=>setActiveWorkspaceTab(tab)}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>
    {activeWorkspaceTab==='start'&&<WorkspaceStart data={data} onNavigate={setActiveWorkspaceTab}/>}
    {activeWorkspaceTab==='home'&&<MemberRoleHome data={data} cases={workerCases} requirements={workerRequirements} openTab={setActiveWorkspaceTab}/>}
    {activeWorkspaceTab==='basic'&&data.role!=='worker'&&<section className="hr-member-card"><h2>基本資料</h2><dl className="workspace-basic-fields"><div><dt>姓名</dt><dd>{data.actor?.name||actor.name||'—'}</dd></div><div><dt>Email</dt><dd>{data.actor?.email||actor.email||'—'}</dd></div><div><dt>會員類型</dt><dd>{data.role==='agency'?(data.agencyType==='taiwan'?'台灣仲介業務':'菲律賓仲介 Staff'):data.roleName||'會員'}</dd></div>{data.role==='employer'&&data.employers[0]&&<div><dt>雇主／客戶</dt><dd>{data.employers[0].name}</dd></div>}{data.role==='agency'&&<><div><dt>所屬仲介</dt><dd>{data.agencies.find(item=>Number(item.id)===Number(data.agencyId))?.name||'—'}</dd></div><div><dt>國家／地區</dt><dd>{data.agencies.find(item=>Number(item.id)===Number(data.agencyId))?.country||'尚未填寫，請聯絡系統管理者補齊'}</dd></div></>}</dl></section>}
    {error&&<p className="hr-request-error" role="alert">{error}</p>}
    {operationMessage&&<p className="hr-request-success" role="status">{operationMessage}</p>}
    {activeWorkspaceTab==='matching'&&data.role==='employer'&&<section className="hr-member-card employer-orders">
      <div className="orders-heading"><div><span className="orders-eyebrow">EMPLOYER PORTAL</span><h2>工作需求單</h2><p>建立需求後即可挑選符合工作類別的未媒合工作者；送出挑選後，系統會直接通知台灣與菲律賓仲介。</p></div><span className="orders-count">{data.jobOrders.length} 張需求單</span></div>
      <form className="worker-form order-form" onSubmit={submitOrder}>
      <label>工作類型<select value={orderForm.jobType} onChange={e=>setOrderForm({...orderForm,jobType:e.target.value})}><option>家庭看護</option><option>家庭幫傭</option><option>機構看護工</option><option>工廠技術工</option><option>農工</option></select></label>
      <label>需求人數<input type="number" min="1" max="100" required value={orderForm.headcount} onChange={e=>setOrderForm({...orderForm,headcount:e.target.value})}/></label>
      <label>預計到職日期<input type="date" value={orderForm.expectedStartDate} onChange={e=>setOrderForm({...orderForm,expectedStartDate:e.target.value})}/></label>
      <label className="form-wide">工作內容／條件<textarea rows="3" value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})}/></label>
      {(()=>{const employer=data.employers[0];const agencyId=Number(employer?.agency_id||0);const employerAgency=activeTaiwanAgencies.find(item=>Number(item.id)===agencyId);const employerActive=employer?.status==='active';return <><label className="form-wide">所屬台灣仲介<input value={employerAgency?.name||'尚未指派台灣仲介，請聯絡管理者協助設定'} readOnly/></label>{employerAgency&&<label>指定業務（選填）<select value={orderForm.brokerMemberId} onChange={e=>setOrderForm(current=>({...current,brokerMemberId:e.target.value}))}><option value="">不指定業務</option>{data.agencyContacts.filter(member=>Number(member.agency_id)===agencyId).map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}{!employerActive&&<p className="hr-request-error form-wide" role="status">雇主資料目前已停用；雖已指派台灣仲介，仍需聯絡管理者啟用雇主資料後才能建立需求單。</p>}<button disabled={orderSubmitting||!employerAgency||!employerActive}>{orderSubmitting?'\u9001出中…':!employerActive?'雇主資料已停用，請聯絡管理者':employerAgency?'建立需求單並送交所屬仲介':'請聯絡管理者設定所屬仲介'}</button></>})()}</form>
      <div className="orders-section"><div className="orders-section-heading"><h3>我的需求與推薦人選</h3><span>{data.jobOrders.length} 張需求單</span></div>{data.jobOrders.length?data.jobOrders.map(order=>{const dispatches=data.orderAgencies.filter(row=>Number(row.job_order_id)===Number(order.id));const selectedWorkerIds=new Set(data.orderCandidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id)).map(candidate=>Number(candidate.worker_id)));const matchingWorkers=orderJourney(order,data.orderAgencies,data.orderRoutes,data.orderCandidates).actionable?(data.availableWorkers||[]).filter(worker=>worker.job_preference===order.job_type&&!selectedWorkerIds.has(Number(worker.id))):[];const statusLabel=({open:'媒合中',sent:'已送出',filled:'已額滿',cancelled:'已取消'})[order.status]||order.status;return <article className="job-order-card" key={order.id}><header className="job-order-header"><div><span className="job-order-number">需求單 #{order.id}</span><h4>{order.job_type}</h4></div><span className={`order-status status-${order.status}`}>{statusLabel}</span></header><OrderJourney order={order} data={data}/>{canEditEmployerOrder(order,data.orderRoutes,data.orderCandidates)&&editingOrderId!==Number(order.id)&&<div className="candidate-actions" style={{padding:'10px 16px 0'}}><button type="button" onClick={()=>editOrder(order)}>&#x7DE8;&#x8F2F;&#x9700;&#x6C42;</button><button type="button" className="candidate-reject" onClick={()=>void deleteOrder(order)}>&#x522A;&#x9664;&#x9700;&#x6C42;</button></div>}{editingOrderId===Number(order.id)&&<form className="worker-form order-form" onSubmit={event=>submitOrderEdit(event,order)}><label>&#x5DE5;&#x4F5C;&#x985E;&#x578B;<select value={orderEditForm.jobType} onChange={event=>setOrderEditForm(current=>({...current,jobType:event.target.value}))}><option>&#x5BB6;&#x5EAD;&#x770B;&#x8B77;</option><option>&#x5BB6;&#x5EAD;&#x5E6B;&#x50F1;</option><option>&#x6A5F;&#x69CB;&#x770B;&#x8B77;&#x5DE5;</option><option>&#x5DE5;&#x5EE0;&#x6280;&#x8853;&#x5DE5;</option><option>&#x8FB2;&#x5DE5;</option></select></label><label>&#x9700;&#x6C42;&#x4EBA;&#x6578;<input type="number" min="1" max="100" required value={orderEditForm.headcount} onChange={event=>setOrderEditForm(current=>({...current,headcount:event.target.value}))}/></label><label>&#x9810;&#x8A08;&#x5230;&#x8077;&#x65E5;&#x671F;<input type="date" value={orderEditForm.expectedStartDate} onChange={event=>setOrderEditForm(current=>({...current,expectedStartDate:event.target.value}))}/></label><label className="form-wide">&#x5DE5;&#x4F5C;&#x5167;&#x5BB9;&#xFF0F;&#x689D;&#x4EF6;<textarea rows="3" value={orderEditForm.description} onChange={event=>setOrderEditForm(current=>({...current,description:event.target.value}))}/></label>{(()=>{const agencyId=Number(data.employers[0]?.agency_id||0);return <><label>&#x6307;&#x5B9A;&#x696D;&#x52D9;&#xFF08;&#x9078;&#x586B;&#xFF09;<select value={orderEditForm.brokerMemberId} onChange={event=>setOrderEditForm(current=>({...current,brokerMemberId:event.target.value}))}><option value="">&#x4E0D;&#x6307;&#x5B9A;&#x696D;&#x52D9;</option>{data.agencyContacts.filter(member=>Number(member.agency_id)===agencyId).map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><div className="candidate-actions"><button type="submit" disabled={orderSubmitting}>&#x5132;&#x5B58;&#x4FEE;&#x6539;</button><button type="button" onClick={cancelOrderEdit}>&#x53D6;&#x6D88;</button></div></>})()}</form>}<div className="job-order-facts"><div><small>需求人數</small><strong>{order.headcount} 人</strong></div><div><small>預計到職</small><strong>{order.expected_start_date?String(order.expected_start_date).slice(0,10):'未指定'}</strong></div><div><small>所屬仲介</small><strong>{dispatches[0]?.taiwan_agency_name||'等待指派'}</strong></div></div>{order.description&&<p className="job-order-description">{order.description}</p>}<div className="candidate-list"><h5>符合此工作類別且尚未有雇主的工作者（{matchingWorkers.length}）</h5>{matchingWorkers.length?matchingWorkers.map(worker=><div className="candidate-card" key={`available-${worker.id}`}><div><strong>{worker.name}</strong><small>{worker.nationality||'—'} · {data.agencies.find(agency=>Number(agency.id)===Number(worker.agency_id))?.name||'菲律賓仲介'}</small></div><div className="candidate-actions"><button type="button" onClick={()=>setProfileWorker(worker)}>查看履歷</button><button type="button" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(worker)}>下載履歷 PDF</button><button type="button" onClick={()=>void selectOrderWorker(order,worker)}>挑選工作者</button></div></div>):<p>{'目前沒有符合此工作類別的未媒合工作者。'}</p>}</div><div className="order-agency-list">{dispatches.length?dispatches.map(dispatch=>{const routes=data.orderRoutes.filter(route=>Number(route.order_agency_id)===Number(dispatch.id));const candidates=data.orderCandidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id)&&Number(candidate.taiwan_agency_id)===Number(dispatch.taiwan_agency_id));return <section className="order-agency-card" key={dispatch.id}><div className="order-agency-heading"><div><small>台灣仲介機構</small><strong>{dispatch.taiwan_agency_name}</strong></div><span>{dispatch.broker_name?`業務：${dispatch.broker_name}`:'尚未指定業務'}</span></div><p className="order-routing">菲律賓媒合：{routes.map(route=>route.philippines_agency_name).join('、')||'-'}</p>{candidates.length>0&&<div className="candidate-list"><h5>推薦人選與面試</h5>{candidates.map(candidate=><div className="candidate-card" key={candidate.id}><div><strong>{candidate.worker_name}</strong><small>{candidate.philippines_agency_name} · {({proposed:'待面試',scheduled:'已安排面試',passed:'錄用',rejected:'未錄用'})[candidate.status]||candidate.status}</small></div>{orderJourney(order,data.orderAgencies,data.orderRoutes,data.orderCandidates).actionable&&candidate.status!=='passed'&&candidate.status!=='rejected'&&<div className="candidate-actions"><button type="button" onClick={()=>interviewDecision(candidate,'scheduled')}>安排面試</button><button type="button" onClick={()=>interviewDecision(candidate,'passed')}>錄用</button><button type="button" className="candidate-reject" onClick={()=>interviewDecision(candidate,'rejected')}>未錄用</button></div>}</div>)}</div>}</section>}) : <div className="order-awaiting"><span>1</span><div><strong>等待仲介機構接單</strong><small>需求已建立，仲介受理後會顯示在這裡。</small></div></div>}</div></article>}):<div className="orders-empty"><span>＋</span><strong>目前還沒有需求單</strong><p>填寫上方需求並選擇仲介，送出後即可在這裡追蹤進度。</p></div>}</div></section>}
    {activeWorkspaceTab==='matching'&&isTaiwanOperator&&data.orderAgencies.length>0&&<section className="hr-member-card"><h2>雇主需求與媒合進度</h2>{data.orderAgencies.map(dispatch=>{const order=data.jobOrders.find(row=>Number(row.id)===Number(dispatch.job_order_id));if(!order)return null;const candidates=data.orderCandidates.filter(candidate=>Number(candidate.job_order_id)===Number(order.id));return <article className="worker-case" key={dispatch.id}><strong>需求 #{order.id} · {order.employer_name} · {order.job_type} · {order.headcount} 人</strong><p>{order.description||'未填工作說明'}</p><p>負責業務：{dispatch.broker_name||'未指定，由機構分派'}</p><OrderJourney order={order} data={data}/>{candidates.length?candidates.map(candidate=><p key={candidate.id}>{candidate.worker_name} · {({proposed:'待面試',scheduled:'已安排面試',passed:'已錄用',rejected:'未錄用'})[candidate.status]||candidate.status}</p>):<p>雇主挑選工作者後，系統會直接通知台灣與菲律賓仲介。</p>}</article>})}</section>}
    {activeWorkspaceTab==='matching'&&isPhilippinesOperator&&data.orderRoutes.length>0&&<section className="hr-member-card"><h2>收到的工作需求與推薦工作者</h2>{data.orderRoutes.map(route=>{const order=data.jobOrders.find(row=>Number(row.id)===Number(route.job_order_id));const dispatch=data.orderAgencies.find(row=>Number(row.id)===Number(route.order_agency_id));if(!order||!orderJourney(order,data.orderAgencies,data.orderRoutes,data.orderCandidates).actionable)return null;const eligibleWorkers=data.workers.filter(w=>Number(w.agency_id)===Number(data.agencyId)&&w.status==='active'&&!data.cases.some(c=>Number(c.worker_id)===Number(w.id)));return <article className="worker-case" key={route.id}><strong>需求 #{order.id} · {order.employer_name} · {order.job_type} · {order.headcount} 人</strong><p>{order.description||'未填工作說明'}</p><p>承接機構：{route.philippines_agency_name}（Staff 作業） · 台灣業務：{dispatch?.broker_name||'未指定'}</p><OrderJourney order={order} data={data}/><form className="agency-choice" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submitWorkflow({type:'job-order-candidate',routeId:route.id,workerId:f.get('workerId'),notes:f.get('notes')});}}><label>推薦所屬工作者<select name="workerId" required><option value="">選擇工作者</option>{eligibleWorkers.map(w=><option key={w.id} value={w.id}>{w.name} · {w.job_preference||'未填意向'}</option>)}</select></label>{eligibleWorkers.length===0&&<small>目前沒有尚未建立案件的可用工作者。</small>}<label>推薦說明<input name="notes"/></label><button disabled={!eligibleWorkers.length}>推薦給雇主面試</button></form>{data.orderCandidates.filter(c=>Number(c.route_id)===Number(route.id)).map(c=><p key={c.id}>{c.worker_name} · {({proposed:'待雇主安排面試',scheduled:'已安排面試',passed:'已錄用',rejected:'未錄用'})[c.status]}</p>)}</article>})}</section>}
    {activeWorkspaceTab==='matching'&&data.role==='agency'&&<section className="hr-member-card"><h2>需求追蹤與歷史</h2><p>進行中需求依目前分工處理；已額滿或取消只保留紀錄。</p>{data.jobOrders.filter(order=>!orderJourney(order,data.orderAgencies,data.orderRoutes,data.orderCandidates).actionable).map(order=><article className="worker-case" key={order.id}><h3>需求 #{order.id} · {order.job_type} · {order.status==='cancelled'?'已取消':'已額滿'}</h3><OrderJourney order={order} data={data}/></article>)}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&isTaiwanOperator && !editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>所屬雇主</h2></div>{data.employers.length?<div className="hr-member-table-wrap"><table><thead><tr><th>雇主／客戶</th><th>類型</th><th>聯絡人</th><th>電話</th><th>操作</th></tr></thead><tbody>{data.employers.map(item=><tr key={item.id}><td>{item.name}</td><td>{{home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'}[item.employer_type]||'其他'}</td><td>{item.contact_name||'—'}</td><td>{item.phone||'—'}</td><td>{Number(item.agency_id)===Number(data.agencyId)&&<button className="table-action" onClick={()=>beginEmployerEdit(item)}>編輯</button>}</td></tr>)}</tbody></table></div>:<p>目前尚無所屬雇主。</p>}</section>}
    {editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>編輯雇主</h2><button className="light-action" onClick={()=>setEditingEmployer(null)}>取消</button></div><form className="worker-form" onSubmit={saveEmployer}><label>雇主／客戶名稱<input required value={employerForm.name} onChange={event=>setEmployerForm(current=>({...current,name:event.target.value}))}/></label><label>雇主類型<select value={employerForm.employerType} onChange={event=>setEmployerForm(current=>({...current,employerType:event.target.value}))}><option value="home_care">家庭看護</option><option value="factory">工廠</option><option value="domestic_helper">家庭幫傭</option><option value="other">其他</option></select></label>{[['contactName','聯絡人'],['phone','電話'],['email','Email'],['address','地址']].map(([field,label])=><label key={field}>{label}<input type={field==='email'?'email':'text'} value={employerForm[field]} onChange={event=>setEmployerForm(current=>({...current,[field]:event.target.value}))}/></label>)}<label className="form-wide">備註<textarea rows="3" value={employerForm.notes} onChange={event=>setEmployerForm(current=>({...current,notes:event.target.value}))}/></label><button disabled={employerSaving}>{employerSaving?'儲存中…':'儲存修改'}</button></form></section>}
    {activeWorkspaceTab==='agencyEmployer'&&isTaiwanOperator && !!data.cases.length && <section className="hr-member-card"><h2>雇主案件與工作者進度</h2><div className="hr-member-table-wrap"><table><thead><tr><th>案件編號</th><th>雇主</th><th>工作者</th><th>進度</th><th>案件狀態</th><th>操作</th></tr></thead><tbody>{data.cases.map(item=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(item.id));const completed=steps.filter(step=>step.started_on||step.completed_on||step.note).length;return <tr key={item.id}><td>{item.case_number}</td><td>{item.employer_name}</td><td>{item.worker_name}</td><td>{completed}/{steps.length} 項已更新</td><td><select className="case-status" value={item.status} onChange={event=>updateCaseStatus(item,event.target.value)}><option value="open">進行中</option><option value="on_hold">暫停</option><option value="closed">結案</option></select></td><td><button className="table-action" onClick={()=>{const worker=data.workers.find(row=>Number(row.id)===Number(item.worker_id));if(worker)setProgressWorker(worker)}}>查看進度</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'agency' && !editingEmployer && <section className="hr-member-card"><div className="card-title"><h2>{isPhilippinesOperator?'所屬工作者與申辦進度':'案件相關工作者'}</h2>{isPhilippinesOperator&&<button onClick={()=>beginWorkerEdit()}>新增工作者</button>}</div>{data.workers.length?<div className="hr-member-table-wrap"><table><thead><tr><th>姓名</th><th>國籍</th><th>工作意向</th><th>申請案件</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.workers.map(item=>{const caseCount=data.cases.filter(row=>Number(row.worker_id)===Number(item.id)).length;const ownsWorker=Number(item.agency_id)===Number(data.agencyId);return <tr key={item.id}><td><button className="worker-link" onClick={()=>setProfileWorker(item)}>{item.name}</button></td><td>{item.nationality||'—'}</td><td>{item.job_preference||'—'}</td><td>{caseCount?`${caseCount} 件`:'尚未媒合'}</td><td>{item.status==='active'?'啟用':'停用'}</td><td><button className="table-action" onClick={()=>caseCount?setProgressWorker(item):setProfileWorker(item)}>{caseCount?'查看進度':'查看資料'}</button><button className="table-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(item)}>下載履歷 PDF</button>{isPhilippinesOperator&&ownsWorker&&<><HrWorkerProgressLink workerId={item.id} /><button className="table-action" onClick={()=>beginWorkerEdit(item)}>編輯</button><button className="table-action" onClick={()=>toggleWorker(item)}>{item.status==='active'?'停用':'啟用'}</button><button className="table-action" onClick={()=>deleteWorker(item)}>移除工人</button></>}</td></tr>})}</tbody></table></div>:<p>目前沒有相關工作者。</p>}</section>}
    {workerEditorOpen&&<div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setWorkerEditorOpen(false);setEditingWorker(null)}}}><section ref={workerEditorDialogRef} tabIndex={-1} onKeyDown={handleWorkerEditorKeyDown} className="progress-modal worker-edit-modal" role="dialog" aria-modal="true" aria-labelledby="worker-edit-title"><header className="progress-modal-header"><div><span>工作者資料</span><h2 id="worker-edit-title">{editingWorker?.id?'編輯工作者':'新增工作者'}</h2></div><button type="button" className="progress-modal-close" aria-label="關閉工作者表單" onClick={()=>{setWorkerEditorOpen(false);setEditingWorker(null)}}>×</button></header><form className="worker-form worker-edit-form" onSubmit={saveWorker}><div className="resume-form-section form-wide"><h3>基本聯絡資料</h3>{(data.role==='worker'||isPhilippinesOperator)&&<div className="resume-import-box"><div className="resume-file-field"><span>上傳 PDF 履歷更新資料</span><HrFilePicker accept="application/pdf,.pdf" onChange={importWorkerResumePdf} disabled={resumeImporting||resumePhotoLoading}/></div><small>讀取到的欄位會先填入表單；確認內容後按「儲存工作者」才會更新。支援可選取文字的 PDF，檔案上限 15 MB。</small>{resumeImporting&&<p role="status">正在讀取履歷 PDF…</p>}{resumeImportMessage&&<p role="status">{resumeImportMessage}</p>}</div>}<div className="resume-form-grid"><PersonNameFields name="name" label="姓名" value={workerForm.name} required onChange={name=>setWorkerForm(current=>({...current,name}))}/><label>國籍<input value={workerForm.nationality} onChange={event=>setWorkerForm(current=>({...current,nationality:event.target.value}))}/></label><label>聯絡電話<input value={workerForm.phone} onChange={event=>setWorkerForm(current=>({...current,phone:event.target.value}))}/></label><label>Email<input type="email" value={workerForm.email} onChange={event=>setWorkerForm(current=>({...current,email:event.target.value}))}/></label><label>工作意向<select required value={workerForm.jobPreference} onChange={event=>setWorkerForm(current=>({...current,jobPreference:event.target.value}))}><option value="">請選擇</option><option value="家庭幫傭">家庭幫傭</option><option value="家庭看護">家庭看護</option><option value="工廠技術工">工廠技術工</option><option value="農工">農工</option><option value="機構看護工">機構看護工</option></select></label><div className="resume-photo-field"><span>履歷照片</span><HrFilePicker accept="image/jpeg,image/png" onChange={uploadWorkerPhoto} hasValue={Boolean(workerForm.resumeProfile.photoDataUrl)}/>{workerForm.resumeProfile.photoDataUrl&&<><img src={workerForm.resumeProfile.photoDataUrl} alt="履歷照片預覽"/><button type="button" className="table-action" onClick={()=>setPhotoCropFile(workerForm.resumeProfile.photoDataUrl)}>重新裁切照片</button></>}</div></div></div>{(()=>{const groups=WORKER_RESUME_GROUPS.length;const started=WORKER_RESUME_GROUPS.filter(group=>group.fields.some(([field])=>{const value=workerForm.resumeProfile[field];return Array.isArray(value)?value.length>0:String(value||'').trim()!=='';})).length;return <div className="resume-completion form-wide"><div><strong>履歷填寫進度</strong><span>已填寫 {started} / {groups} 個章節</span></div><progress value={started} max={groups} aria-label="履歷章節填寫進度"/></div>})()}{WORKER_RESUME_GROUPS.map(group=><fieldset className="resume-form-section form-wide" key={group.title}><legend>{group.title}</legend><div className="resume-form-grid">{group.fields.map(([field,label])=><ResumeFieldEditor key={field} field={field} label={label} workerForm={workerForm} updateWorkerResume={updateWorkerResume}/>) }</div></fieldset>)}<label className="form-wide">備註<textarea rows="3" value={workerForm.notes} onChange={event=>setWorkerForm(current=>({...current,notes:event.target.value}))}/></label><div className="worker-edit-actions"><button type="button" className="worker-edit-cancel" onClick={()=>{setWorkerEditorOpen(false);setEditingWorker(null)}}>取消</button><button disabled={workerSaving||resumePhotoLoading||resumeImporting}>{resumePhotoLoading?'讀取照片中…':resumeImporting?'讀取履歷中…':workerSaving?'儲存中…':'儲存工作者'}</button></div></form></section></div>}
    {photoCropFile&&<HrPhotoCropper file={photoCropFile} onCancel={()=>setPhotoCropFile(null)} onConfirm={photoDataUrl=>{updateWorkerResume('photoDataUrl',photoDataUrl);setPhotoCropFile(null);}}/>}
    {workerToDelete&&<div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setWorkerToDelete(null);setDeleteWorkerError('')}}}><section ref={deleteWorkerDialogRef} tabIndex={-1} onKeyDown={handleDeleteWorkerKeyDown} className="progress-modal delete-worker-modal" role="dialog" aria-modal="true" aria-labelledby="delete-worker-title"><header className="progress-modal-header"><div><span>移除工人</span><h2 id="delete-worker-title">{`確定將工人「${workerToDelete.name}」從此仲介移除？`}</h2></div><button type="button" className="progress-modal-close" aria-label="關閉移除確認" onClick={()=>{setWorkerToDelete(null);setDeleteWorkerError('')}}>×</button></header><div className="progress-modal-body"><p className="delete-worker-error">只會清除該工作者的所屬仲介，不會刪除工作者資料或申辦紀錄。</p>{deleteWorkerError&&<p className="delete-worker-error" role="alert">{deleteWorkerError}</p>}<div className="worker-edit-actions"><button type="button" className="worker-edit-cancel" onClick={()=>{setWorkerToDelete(null);setDeleteWorkerError('')}}>取消</button><button type="button" className="worker-delete-confirm" onClick={confirmDeleteWorker}>移除工人</button></div></div></section></div>}
    {activeWorkspaceTab==='basic'&&data.role === 'worker' && viewedWorker && <section className="hr-member-card resume-profile-card"><header className="resume-profile-header"><div><span className="orders-eyebrow">WORKER PROFILE</span><h2>我的資料</h2><p>完善履歷資料，讓合作仲介與雇主了解你的技能和工作經驗。</p></div><div><button type="button" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(viewedWorker)}>{resumePdfLoading?'產生中…':'下載履歷 PDF'}</button><button type="button" onClick={()=>beginWorkerEdit(viewedWorker)}>編輯履歷</button></div></header><div className="worker-detail resume-contact"><p>姓名：{viewedWorker.name}</p><p>國籍：{viewedWorker.nationality||'—'}</p><p>電話：{viewedWorker.phone||'—'}</p><p>Email：{viewedWorker.email||'—'}</p><p>工作意向：{viewedWorker.job_preference||'—'}</p></div>{resumeViewPhoto&&<img className="resume-profile-photo" src={resumeViewPhoto} alt="履歷照片"/>}<WorkerResumeSections profile={viewedWorker.resume_profile}/></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role==='worker'&&workerCases.length>0&&<section className="hr-member-card"><h2>台灣仲介業務</h2>{workerCases.map(item=><p key={item.id}>{item.case_number} · {item.broker_name||'尚未指定'}</p>)}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'employer' && !!data.cases.length && <section className="hr-member-card"><h2>所屬仲介案件與配工工作者</h2><div className="hr-member-table-wrap"><table><thead><tr><th>案件編號</th><th>工作者</th><th>進度</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.cases.map(item=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(item.id));const completed=steps.filter(step=>step.started_on||step.completed_on||step.note).length;return <tr key={item.id}><td>{item.case_number}</td><td>{item.worker_name}</td><td>{completed}/{steps.length} 項已更新</td><td>{({open:'進行中',on_hold:'暫停',closed:'結案'})[item.status]||item.status}</td><td><button className="table-action" onClick={()=>{const worker=data.workers.find(row=>Number(row.id)===Number(item.worker_id));if(worker)setProgressWorker(worker)}}>查看工作者進度</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role === 'employer' && !progressWorker && data.workers.some(item=>!item.sharedAgencyCaseOnly) && <section className="hr-member-card"><h2>我的工作者與未媒合人選</h2><div className="hr-member-table-wrap"><table><thead><tr><th>姓名</th><th>國籍</th><th>工作意向</th><th>所屬仲介</th><th>狀態</th><th>進度</th><th>履歷</th></tr></thead><tbody>{data.workers.filter(item=>!item.sharedAgencyCaseOnly).map(item=>{const agency=data.agencies.find(row=>Number(row.id)===Number(item.agency_id));const hasCase=data.cases.some(row=>Number(row.worker_id)===Number(item.id));return <tr key={item.id}><td>{item.name}</td><td>{item.nationality||'—'}</td><td>{item.job_preference||'—'}</td><td>{agency?.name||'—'}</td><td>{item.status==='active'?'啟用':'停用'}</td><td>{hasCase?<button className="table-action" onClick={()=>setProgressWorker(item)}>查看進度</button>:'尚未媒合'}</td><td><button className="table-action" onClick={()=>setProfileWorker(item)}>查看履歷</button><button className="table-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(item)}>下載 PDF</button></td></tr>})}</tbody></table></div></section>}
    {activeWorkspaceTab==='documents'&&<section className="hr-member-card"><h2>必要文件與審核</h2>{data.role==='worker'?(documentWorkers.length?documentWorkers.map(person=>{const personCases=workerCases.filter(item=>Number(item.worker_id)===Number(person.id));const stageCase=personCases.find(item=>item.status!=='closed')||personCases[0]||null;return <WorkerStageDocuments key={person.id} workerName={person.name} caseItem={stageCase} requirements={data.requirements.filter(item=>Number(item.worker_id)===Number(person.id))} steps={stageCase?(data.applicationSteps||[]).filter(item=>Number(item.case_id)===Number(stageCase.id)):[]} acknowledgments={stageCase?(data.acknowledgments||[]).filter(item=>Number(item.case_id)===Number(stageCase.id)):[]} renderDocumentItem={renderDocumentItem} onAcknowledge={acknowledge} />;}):<p>目前沒有必要文件項目。</p>):(documentWorkers.length?<HrDocumentReviewList workers={documentWorkers} requirements={data.requirements} renderItem={renderCompactDocument} />:<p>目前沒有必要文件項目。</p>)}{workerCases.some(caseItem=>(data.certifications||[]).some(cert=>Number(cert.case_id)===Number(caseItem.id)))&&<div className="worker-case"><h3>案件必備證照與取證進度</h3>{workerCases.map(caseItem=>{const certs=(data.certifications||[]).filter(cert=>Number(cert.case_id)===Number(caseItem.id));return certs.length?<div key={caseItem.id}><h4>{caseItem.case_number} · {caseItem.worker_name}（{caseItem.job_type}）</h4>{certs.map(cert=><div className="document-item" key={cert.id}><div className="document-heading"><div><strong>{cert.name}</strong>{cert.target_date&&<small>預計取得：{String(cert.target_date).slice(0,10)}</small>}</div><span className={`doc-status doc-${cert.status==='obtained'?'approved':'missing'}`}>{CERTIFICATION_LABELS[cert.status]||cert.status}</span></div>{canUpdateCertification&&<div className="document-actions"><select value={cert.status} onChange={event=>updateCertification(cert,event.target.value)} aria-label={`${cert.name} 取證進度`}>{Object.entries(CERTIFICATION_LABELS).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></div>}</div>)}</div>:null})}</div>}{data.role==='worker'&&<div className="stage-footnotes"><p className="stage-notice">{STAGE_NOTICE}</p><h3>遇到問題怎麼辦</h3><p className="stage-notice">{STAGE_HELP}</p></div>}</section>}
    {activeWorkspaceTab==='process'&&<section className="hr-member-card"><h2>赴台申請程序</h2>{workerCases.length?workerCases.map(caseItem=><div className="worker-case" key={caseItem.id}><h3>{caseItem.case_number} · {caseItem.employer_name}</h3>{data.applicationSteps.filter(step=>Number(step.case_id)===Number(caseItem.id)).map(step=>{const singleDate=['match_date','passport','document_arrival','personal_documents','pdos','medical','accr_in','accr_out','umid','expected_entry','actual_entry'].includes(step.step_key);const canEdit=canManageCaseProgress;return <form className="process-row" key={step.id} onSubmit={event=>saveApplicationStep(event,step)}><strong>{step.label}</strong>{singleDate?<label>{step.step_key==='expected_entry'?'預定入境日期':step.step_key==='actual_entry'?'實際入境日期':step.step_key==='match_date'?'配工／面試日期':step.step_key==='passport'?'護照確認日期':step.step_key==='document_arrival'?'文件到達日期':step.step_key==='personal_documents'?'個人文件確認日期':step.step_key==='pdos'?'PDOS 日期':step.step_key==='medical'?'體檢日期':step.step_key==='accr_in'?'入件日期':step.step_key==='accr_out'?'出件日期':'辦理日期'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label>:<><label>{step.step_key==='training'?'訓練開始日':'辦件／開始日'}<input type="date" name="startedOn" defaultValue={step.started_on?String(step.started_on).slice(0,10):''} disabled={!canEdit}/></label><label>{step.step_key==='training'?'訓練完成日':'完成／出件日'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label></>}<input name="note" placeholder="狀態／備註" defaultValue={step.note||''} disabled={!canEdit}/>{canEdit&&<button disabled={stepSaving===`${step.case_id}:${step.step_key}`}>{stepSaving===`${step.case_id}:${step.step_key}`?'儲存中…':'儲存'}</button>}</form>})}</div>):<p>目前沒有來台申請程序。</p>}</section>}
    {activeWorkspaceTab==='agencyEmployer'&&data.role==='worker'&&!!data.employers.length && <section className="hr-member-card"><h2>我的雇主</h2><div className="hr-member-table-wrap"><table><thead><tr><th>雇主／客戶</th><th>類型</th><th>聯絡人</th><th>狀態</th></tr></thead><tbody>{data.employers.map(item => <tr key={item.id}><td>{item.name}</td><td>{{home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'}[item.employer_type] || '其他'}</td><td>{item.contact_name || '—'}</td><td>{item.status === 'active' ? '啟用' : '停用'}</td></tr>)}</tbody></table></div></section>}
    {activeWorkspaceTab==='agencyEmployer'&&!!data.agencies.length && data.role === 'worker' && <section className="hr-member-card"><h2>所屬仲介</h2><ul>{data.agencies.map(item => <li key={item.id}>{item.name}（{item.country || (item.agency_type === 'taiwan' ? '台灣' : '菲律賓')}）</li>)}</ul></section>}
    {profileWorker && <div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setProfileWorker(null)}}><section ref={profileDialogRef} tabIndex={-1} onKeyDown={handleProfileKeyDown} className="progress-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title"><header className="progress-modal-header"><div><span>工作者資料</span><h2 id="profile-modal-title">{profileWorker.name}</h2></div><div className="profile-modal-actions"><button type="button" className="profile-edit-action" disabled={resumePdfLoading} onClick={()=>void downloadWorkerResume(profileWorker)}>{resumePdfLoading?'產生中…':'下載履歷 PDF'}</button>{isPhilippinesOperator&&Number(profileWorker.agency_id)===Number(data.agencyId)&&<button type="button" className="profile-edit-action" onClick={()=>{setProfileWorker(null);beginWorkerEdit(profileWorker)}}>編輯資料</button>}<button type="button" className="progress-modal-close" aria-label="關閉工作者資料" onClick={()=>setProfileWorker(null)}>×</button></div></header><div className="progress-modal-body"><div className="worker-detail"><p>姓名：{profileWorker.name}</p><p>國籍：{profileWorker.nationality||'—'}</p><p>電話：{profileWorker.phone||'—'}</p><p>Email：{profileWorker.email||'—'}</p><p>工作意向：{profileWorker.job_preference||'—'}</p><p>狀態：{profileWorker.status==='active'?'啟用':'停用'}</p></div>{resumeViewPhoto&&<img className="resume-profile-photo" src={resumeViewPhoto} alt="履歷照片"/>}<WorkerResumeSections profile={profileWorker.resume_profile}/>{profileWorker.notes&&<div className="profile-notes"><strong>備註</strong><p>{profileWorker.notes}</p></div>}</div></section></div>}
    {progressWorker && <div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setProgressWorker(null)}}><section ref={progressDialogRef} tabIndex={-1} onKeyDown={handleProgressKeyDown} className="progress-modal" role="dialog" aria-modal="true" aria-labelledby="progress-modal-title"><header className="progress-modal-header"><div><span>案件進度</span><h2 id="progress-modal-title">{progressWorker.name}</h2></div><button type="button" className="progress-modal-close" aria-label="關閉進度視窗" onClick={()=>setProgressWorker(null)}>×</button></header><div className="progress-modal-body"><div className="worker-detail"><p>國籍：{progressWorker.nationality||'—'}</p><p>工作意向：{progressWorker.job_preference||'—'}</p><p>所屬仲介：{data.agencies.find(row=>Number(row.id)===Number(progressWorker.agency_id))?.name||'—'}</p></div>{data.cases.filter(item=>Number(item.worker_id)===Number(progressWorker.id)).map(caseItem=>{const steps=data.applicationSteps.filter(step=>Number(step.case_id)===Number(caseItem.id));const requirements=data.requirements.filter(item=>Number(item.case_id)===Number(caseItem.id));return <article className="progress-modal-case" key={caseItem.id}><h3>{caseItem.case_number} · {caseItem.employer_name||'雇主未指定'}</h3><h4>必要文件</h4>{requirements.length?<ul className="progress-document-list">{requirements.map(item=><li key={item.id}><span>{item.name}</span><strong className={`doc-status doc-${item.applicable?item.status:'na'}`}>{!item.applicable?'不適用':({missing:'待收件',submitted:'待審核',approved:'已合格',returned:'退件待修正'}[item.status]||item.status)}</strong></li>)}</ul>:<p>此案件尚無必要文件資料。</p>}<h4>赴台申請程序</h4>{steps.map(step=>{const canEdit=data.role==='agency';const singleDate=['match_date','passport','document_arrival','personal_documents','pdos','medical','accr_in','accr_out','umid','expected_entry','actual_entry'].includes(step.step_key);return <form className="progress-step" key={step.id} onSubmit={event=>saveApplicationStep(event,step)}><strong>{step.label}</strong>{singleDate?<label>{step.step_key==='expected_entry'?'預定入境日期':step.step_key==='actual_entry'?'實際入境日期':step.step_key==='match_date'?'配工／面試日期':'辦理日期'}<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label>:<><label>開始日<input type="date" name="startedOn" defaultValue={step.started_on?String(step.started_on).slice(0,10):''} disabled={!canEdit}/></label><label>完成日<input type="date" name="completedOn" defaultValue={step.completed_on?String(step.completed_on).slice(0,10):''} disabled={!canEdit}/></label></>}<input name="note" placeholder="狀態／備註" defaultValue={step.note||''} disabled={!canEdit}/>{canEdit&&<button disabled={stepSaving===`${step.case_id}:${step.step_key}`}>{stepSaving===`${step.case_id}:${step.step_key}`?'儲存中…':'儲存'}</button>}</form>})}</article>})}{data.cases.every(item=>Number(item.worker_id)!==Number(progressWorker.id))&&<p>此工作者目前沒有申辦案件。</p>}</div></section></div>}
    {returnDocument&&<div className="progress-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setReturnDocument(null);setReturnError('')}}}><section ref={reviewDialogRef} tabIndex={-1} onKeyDown={handleReviewDialogKeyDown} className="progress-modal review-document-modal" role="dialog" aria-modal="true" aria-labelledby="return-document-title"><header className="progress-modal-header"><div><span>文件審核</span><h2 id="return-document-title">退回「{returnDocument.name}」</h2></div><button type="button" className="progress-modal-close" aria-label="關閉補件原因視窗" onClick={()=>{setReturnDocument(null);setReturnError('')}}>×</button></header><form className="progress-modal-body return-document-form" onSubmit={submitDocumentReturn}><p>工作者會看到這段說明，請具體指出需要修正或補交的內容。</p><label htmlFor="document-return-reason">補件原因（必填）</label><textarea id="document-return-reason" autoFocus required rows={5} value={returnReason} onChange={event=>setReturnReason(event.target.value)} aria-describedby={returnError?'document-return-error':undefined}/>{returnError&&<p id="document-return-error" className="delete-worker-error" role="alert">{returnError}</p>}<div className="worker-edit-actions"><button type="button" className="worker-edit-cancel" disabled={reviewSaving} onClick={()=>{setReturnDocument(null);setReturnError('')}}>取消</button><button type="submit" disabled={reviewSaving}>{reviewSaving?'送出中…':'退回並通知工作者'}</button></div></form></section></div>}
    <section className="workspace-chat-page" hidden={activeWorkspaceTab!=='chat'}><HrChat /></section>
    <footer className="hr-member-footer">資料僅供授權帳號查閱。</footer>

  </main>;
}
