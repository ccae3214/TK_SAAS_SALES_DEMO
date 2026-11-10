"use client";

import styles from './HrManagement.module.css';
import { useLanguage } from '@/context/LanguageContext';
import PersonNameFields from '@/components/PersonNameFields';
import { WORKER_RESUME_YES_NO } from '@/lib/hr-resume-import';
import {
  WORKER_RESUME_CHOICES,
  WORKER_RESUME_LANGUAGES,
  WORKER_RESUME_LANGUAGE_LEVELS,
  WORKER_RESUME_SELECTS,
  WORKER_RESUME_SKIN_COMPLEXIONS,
  readLanguageLevels,
  resumeChoiceList,
} from '@/lib/hr-resume-fields';

const DATE_FIELDS = ['birthDate','fatherBirthDate','motherBirthDate'];
const TEXTAREA_FIELDS = new Set(['address','hobby','education','coursesCompleted','applianceSkills','experienceNewborn','experienceChildren','experienceElderly','experienceDisabled','petExperience','caregiverDuringOverseas']);

function LanguageSkillsControl({ label, profile, setField }) {
  const selected = resumeChoiceList(profile.languageOptions);
  const levels = readLanguageLevels(profile.languages, selected);
  function updateSelected(next) {
    const nextLevels = readLanguageLevels(profile.languages, next);
    setField('languageOptions', next.join('、'));
    setField('languages', JSON.stringify(nextLevels));
  }
  function updateLevel(language, level) { setField('languages', JSON.stringify({ ...levels, [language]: level })); }
  return <fieldset className={`${styles.resumeChoiceField} ${styles.resumeFieldWide}`}>
    <legend>{label}</legend>
    <div className={styles.resumeChoiceList}>
      {WORKER_RESUME_LANGUAGES.map(language => <label className={styles.resumeChoiceItem} key={language}>
        <input type="checkbox" checked={selected.includes(language)} onChange={event => updateSelected(event.target.checked ? [...selected, language] : selected.filter(value => value !== language))} />
        <span>{language}</span>
      </label>)}
    </div>
    {selected.map(language => <label className={styles.resumeLanguageLevel} key={language}>
      <span>{language}</span>
      <select value={levels[language] || 'basic'} onChange={event => updateLevel(language, event.target.value)}>
        {WORKER_RESUME_LANGUAGE_LEVELS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>)}
  </fieldset>;
}

function SelectControl({ label, value, options, keepLegacy = true, onChange, required = false }) {
  return <label className={styles.field}>{label}
    <select required={required} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">請選擇</option>
      {keepLegacy && value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map(choice => <option key={choice} value={choice}>{choice}</option>)}
    </select>
  </label>;
}

// Admin-side counterpart of the worker portal's ResumeFieldEditor. It renders the
// same dropdown / checkbox / radio controls so admins edit a resume exactly as the
// worker does. Experience lists are handled separately by WorkerResumeModal.
export default function HrResumeFieldControl({ field, label, profile, setField }) {
  const { lang } = useLanguage();
  const value = profile[field] || '';
  const change = next => setField(field, next);

  // `languageOptions` is edited together with `languages` by the language control.
  if (field === 'languageOptions') return null;
  if (field === 'languages') return <LanguageSkillsControl label={label} profile={profile} setField={setField} />;

  if (['spouseName', 'fatherName', 'motherName'].includes(field)) {
    return <PersonNameFields name={field} label={label} className={styles.field} value={value} onChange={change} />;
  }

  if (field === 'religion') {
    const known = value === '天主教' || /catholic/i.test(value) ? '天主教' : value === '基督教' || /christian/i.test(value) ? '基督教' : '';
    const other = value.startsWith('其他：') ? value.slice(3) : value === '其他' ? '' : value;
    const selected = known || (value ? '其他' : '');
    return <>
      <label className={styles.field}>{label}
        <select value={selected} onChange={event => change(event.target.value === '其他' ? '其他' : event.target.value)}>
          <option value="">請選擇</option>
          <option value="天主教">天主教</option>
          <option value="基督教">基督教</option>
          <option value="其他">其他</option>
        </select>
      </label>
      {selected === '其他' && <label className={styles.field}>請填寫其他宗教
        <input required value={other} onChange={event => change(`其他：${event.target.value}`)} />
      </label>}
    </>;
  }

  const choices = WORKER_RESUME_CHOICES[field];
  if (choices) {
    const selected = resumeChoiceList(value);
    return <fieldset className={`${styles.resumeChoiceField} ${styles.resumeFieldWide}`}>
      <legend>{label}</legend>
      <div className={styles.resumeChoiceList}>
        {choices.map(choice => <label className={styles.resumeChoiceItem} key={choice}>
          <input type="checkbox" checked={selected.includes(choice)} onChange={event => change(event.target.checked ? [...selected, choice].join('、') : selected.filter(item => item !== choice).join('、'))} />
          <span>{choice}</span>
        </label>)}
      </div>
    </fieldset>;
  }

  if (field === 'gender') {
    return <label className={styles.field}>{label}
      <select value={value} onChange={event => change(event.target.value)}>
        <option value="">請選擇</option>
        {value && !['male', 'female'].includes(value) && <option value={value}>{value}</option>}
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>
    </label>;
  }

  if (field === 'referenceNo') {
    return <label className={styles.field}>{label}
      <input value={value} maxLength={80} placeholder="依工作類型與性別自動編號" onChange={event => change(event.target.value)} />
    </label>;
  }

  if (WORKER_RESUME_SELECTS[field]) return <SelectControl label={label} value={value} options={WORKER_RESUME_SELECTS[field]} onChange={change} />;
  if (field === 'skinComplexion') return <SelectControl label={label} value={value} options={WORKER_RESUME_SKIN_COMPLEXIONS} onChange={change} />;

  if (WORKER_RESUME_YES_NO.has(field)) {
    return <fieldset className={`${styles.resumeRadioField} ${styles.resumeFieldWide}`}>
      <legend>{label}</legend>
      <div>
        {['是', '否'].map(option => <label key={option}>
          <input type="radio" name={`admin-resume-${field}`} value={option} checked={value === option} onChange={event => change(event.target.value)} />
          <span>{option}</span>
        </label>)}
      </div>
    </fieldset>;
  }

  if (['childrenAges', 'brotherAges', 'sisterAges'].includes(field)) {
    return <label className={styles.field}>{label}
      <input type="text" placeholder="18,5,2,1" value={value} onChange={event => change(event.target.value)} />
      <small className={styles.formHint}>請用逗號分隔，並由大到小排列。例如：18,5,2,1</small>
    </label>;
  }

  const isDate = DATE_FIELDS.includes(field);
  const isTextarea = TEXTAREA_FIELDS.has(field);
  return <label className={`${styles.field} ${isTextarea ? styles.resumeFieldWide : ''}`}>{label}
    {isTextarea
      ? <textarea rows="3" value={value} onChange={event => change(event.target.value)} />
      : <input lang={isDate ? lang : undefined} type={isDate ? 'date' : 'text'} value={value} onChange={event => change(event.target.value)} />}
  </label>;
}
