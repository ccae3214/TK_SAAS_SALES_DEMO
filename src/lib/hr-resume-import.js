// 共用的 PDF 履歷匯入：讀取 PDF 文字、擷取欄位與照片。
// 工人頁面、管理者與仲介編輯工人履歷時共用，確保解析結果一致。
export const WORKER_RESUME_YES_NO = new Set(['hasTattoo','smokes','drinksAlcohol','willingToWorkWithPets','seriousIllness','operationLast12Months','allergies','dayOffChores','finishChoresBeforeOuting','returnBy8PM','makeupAtWork','workOnDaysOff','workedAbroad']);
const RESUME_IMPORT_LABELS = [
  ['referenceNo',['resume reference number','reference no','resume no','履歷編號']],['birthDate',['date of birth','birth date','出生日期']],['gender',['sex','gender','性別']],['birthplace',['place of birth','birthplace','出生地']],['address',['address','present address','地址']],['height',['height','身高']],['weight',['weight','體重']],['skinComplexion',['complexion','膚色']],['maritalStatus',['marital status','婚姻狀況']],['religion',['religion','宗教']],['hobby',['hobbies','hobby','興趣']],
  ['spouseName',['spouse name','husband/wife','配偶姓名']],['spouseOccupation',['spouse occupation','配偶職業']],['spouseAge',['spouse age','配偶年齡']],['numberOfChildren',['number of children','no. of children','子女人數']],['childrenAges',['children ages','ages of children','子女年齡']],['fatherName',['father name','父親姓名']],['fatherOccupation',['father occupation','父親職業']],['fatherBirthDate',['father date of birth','father birth date','父親出生日期']],['motherName',['mother name','母親姓名']],['motherOccupation',['mother occupation','母親職業']],['motherBirthDate',['mother date of birth','mother birth date','母親出生日期']],['brotherCount',['number of brothers','兄弟人數']],['brotherAges',['brothers ages','兄弟年齡']],['sisterCount',['number of sisters','姊妹人數']],['sisterAges',['sisters ages','姊妹年齡']],['familyRank',['birth order','家中排行']],['caregiverDuringOverseas',['child caregiver while abroad','出國工作期間子女照顧者']],['education',['education','educational attainment','教育背景']],['coursesCompleted',['course completed','courses completed','courses attended','training completed','完成課程']],['languages',['language','languages','language proficiency','語言能力']],['cookingSkills',['cooking skills','烹飪技能']],['applianceSkills',['home electrical appliance operation','appliances operated','home appliances','家電操作']],['childcareSkills',['childcare skills','嬰幼兒照護技能']],['experienceNewborn',['newborn experience','newborn care experience','新生兒照護經驗']],['experienceChildren',['childcare experience','children care experience','兒童照護經驗']],['experienceElderly',['elderly care experience','elder care experience','長者照護經驗']],['experienceDisabled',['disabled care experience','身心障礙者照護經驗']],['hasTattoo',['tattoo','do you have a tattoo','是否有刺青']],['smokes',['smoking','do you smoke','是否吸菸']],['drinksAlcohol',['drinking alcohol','do you drink alcohol','是否飲酒']],['petExperience',['pet care experience','pets experience','寵物照護經驗與種類']],['willingToWorkWithPets',['willing to work with pets','是否願意在有寵物的家庭工作']],['seriousIllness',['serious illness','是否曾有重大疾病']],['operationLast12Months',['operation in the last 12 months','surgery in the last 12 months','過去 12 個月是否接受手術']],['allergies',['allergies','do you have allergies','是否有過敏']],['dayOffChores',['chores on day off','休假日是否願意完成家務']],['finishChoresBeforeOuting',['finish chores before going out','外出前是否完成家務']],['returnBy8PM',['return home by 8 pm','休假日是否可於晚上 8 點前返家']],['makeupAtWork',['makeup at work','工作時是否化妝']],['workOnDaysOff',['work on days off','休假日是否願意加班']],['workedAbroad',['worked abroad','是否曾在海外工作']],['employmentHistory',['employment history','work experience','工作經歷']],['overseasWorkDetails',['overseas work details','overseas employment','海外工作地點與期間']],['remarks',['remarks','additional information','其他說明']],
];
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
const QUESTIONNAIRE_YES_NO_LABELS = {
  hasTattoo:['Do you have a tattoo','Do you have tattoos','Have you ever had a tattoo','Tattoo','是否有刺青','是否有紋身'],
  smokes:['Do you smoke','Smoking','是否吸菸','是否抽菸'],
  drinksAlcohol:['Do you drink alcohol','Drinking alcohol','Alcohol','是否飲酒','是否喝酒'],
  willingToWorkWithPets:['Willing to work with pets','Willing to work in a home with pets','是否願意在有寵物的家庭工作'],
  seriousIllness:['Have you ever had a serious illness','Serious illness','是否曾有重大疾病','是否有重大疾病'],
  operationLast12Months:['Have you had surgery in the last 12 months','Surgery in the last 12 months','Operation in the last 12 months','過去 12 個月是否接受手術'],
  allergies:['Do you have allergies','Allergies','是否有過敏','是否有任何過敏'],
  dayOffChores:['Willing to do household chores on your day off','Chores on day off','是否願意於休假日做家務','休假日是否願意完成家務'],
  finishChoresBeforeOuting:['Will you finish your chores before going out','Finish chores before going out','外出前是否完成家務'],
  returnBy8PM:['Can you return home by 8 pm','Return home by 8 pm','休假日是否可於晚上 8 點前返家'],
  makeupAtWork:['Do you wear makeup at work','Makeup at work','工作時是否化妝'],
  workOnDaysOff:['Willing to work on your day off','Work on days off','休假日是否願意加班'],
  workedAbroad:['Have you ever worked abroad','Worked abroad','是否曾在海外工作'],
};
function extractQuestionnaireAnswers(text) {
  const lines=String(text||'').split(/\r?\n/).map(normalizeResumeLine).filter(Boolean);
  const allLabels=Object.values(QUESTIONNAIRE_YES_NO_LABELS).flat().map(label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const questionPattern=new RegExp(`(?:${allLabels})`,'i');
  const checkedMarker='(?:☑|☒|✓|✔|√|\\[\\s*[xX✓✔]\\s*\\]|\\(\\s*[xX✓✔]\\s*\\))';
  const anyMarker='(?:☑|☒|✓|✔|√|☐|□|\\[\\s*[xX✓✔ ]\\s*\\]|\\(\\s*[xX✓✔ ]\\s*\\))';
  const answers={};
  for(const [field,labels] of Object.entries(QUESTIONNAIRE_YES_NO_LABELS)){
    const escaped=labels.map(label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length).join('|');
    const labelPattern=new RegExp(escaped,'i');
    for(let index=0;index<lines.length;index++){
      const match=labelPattern.exec(lines[index]);
      if(!match)continue;
      const nearby=[lines[index].slice(match.index+match[0].length),...lines.slice(index+1,index+4)];
      const answerText=[];
      for(const line of nearby){
        const nextQuestion=line.search(questionPattern);
        answerText.push(nextQuestion>=0?line.slice(0,nextQuestion):line);
        if(nextQuestion>=0)break;
      }
      const answer=answerText.join(' ');
      const options=[...answer.matchAll(/(?:yes|no|是|否)(?![\w])/ig)].map(match=>({value:/^(?:yes|是)$/i.test(match[0])?'是':'否',start:match.index,end:match.index+match[0].length}));
      const markers=[...answer.matchAll(new RegExp(anyMarker,'ig'))].map(match=>({text:match[0],start:match.index,end:match.index+match[0].length,checked:new RegExp(`^${checkedMarker}$`,'i').test(match[0])}));
      let markPlacement='before';
      if(markers.length&&options.length){
        if(markers[0].end<=options[0].start)markPlacement='before';
        else if(markers[markers.length-1].start>=options[options.length-1].end)markPlacement='after';
      }
      const selected=markers.filter(marker=>marker.checked).map(marker=>{
        const target=markPlacement==='before'
          ?options.find(option=>option.start>=marker.end)
          :options.slice().reverse().find(option=>option.end<=marker.start);
        const distance=target?(markPlacement==='before'?target.start-marker.end:marker.start-target.end):Infinity;
        return distance<=12?target.value:'';
      }).filter(Boolean);
      if(selected.length===1){answers[field]=selected[0];break;}
      const explicit=answer.match(/^[\s:：?？-]*(yes|no|是|否)(?![\w])/i);
      if(!markers.length&&explicit&&!/(?:\byes\b|\bno\b|是|否).*(?:\byes\b|\bno\b|是|否)/i.test(answer)){
        answers[field]=/^(?:yes|是)$/i.test(explicit[1])?'是':'否';
        break;
      }
    }
  }
  return answers;
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

// 讀取 PDF 履歷，回傳 { topLevel, parsed, importedPhoto }；格式或內容有問題時丟出帶中文訊息的 Error。
export async function parseResumePdf(file) {
  if(!file||(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')))throw new Error('請選擇 PDF 履歷檔。');
  if(file.size>15*1024*1024)throw new Error('PDF 檔案需小於 15 MB。');
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
      const extracted=pages.join('\n'),parsed=extractResumeFields(extracted);Object.assign(parsed,extractQuestionnaireAnswers(extracted));delete parsed.remarks;
      if(!extracted.trim())throw new Error('這份 PDF 沒有可讀取的文字，可能是掃描影像；請改用可選取文字的 PDF，或直接填寫欄位。');
      if(importedPhoto)parsed.photoDataUrl=importedPhoto;
      const educationSection=captureResumeSection(extracted,/EDUCATIONAL\s+BACK(?:GROUND|ROUND)|教育背景/i,/COURSE\s+COMPLETED|完成課程/i);
      const languageSection=captureResumeSection(extracted,/\bLANGUAGE\b|語言/i,/COOKING\s+SKILLS|烹飪/i);
      const cookingSection=captureResumeSection(extracted,/COOKING\s+SKILLS|烹飪/i,/HOME\s+ELECTRICAL\s+APPLIANCE\s+OPERATION|家電操作/i);
      const applianceSection=captureResumeSection(extracted,/HOME\s+ELECTRICAL\s+APPLIANCE\s+OPERATION|家電操作/i,/BABY\s+SITTING|嬰兒及兒童護理|嬰幼兒/i);
      if(educationSection){parsed.education=educationSection;parsed.educationLevels=/doctor|\bph\.?\s?d\b|\bed\.?\s?d\b|博士/i.test(educationSection)?'博士學位':/master|\bmba\b|post.?graduate|研究所|碩士/i.test(educationSection)?'碩士學位':/associate|專科|副學士/i.test(educationSection)&&!/university|bachelor|大學|學士/i.test(educationSection)?'副學士 / 專科學位':/college|university|bachelor|大學|學士/i.test(educationSection)?'學士學位（大學畢業）':/senior\s*high|high\s*school|secondary|高中|vocational|職業培訓/i.test(educationSection)?'高中畢業':'';}
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
    return {topLevel,parsed,importedPhoto};
  }finally{try{await pdfDocument?.destroy();}catch{}worker?.terminate();}
}
