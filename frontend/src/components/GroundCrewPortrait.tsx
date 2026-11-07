// Original, lightweight vector crew portraits for the away-team command rail.
// Not a screenshot, franchise asset or substitute for a crew health system.
type PortraitPalette = { jacket: string; trim: string; skin: string; hair: string; style: 'swept' | 'close' | 'long' };
const portraits: Record<string, PortraitPalette> = {
  venn: { jacket: '#2f667a', trim: '#a5d4df', skin: '#ae7758', hair: '#202f37', style: 'swept' },
  dorn: { jacket: '#997244', trim: '#e4c59a', skin: '#b98a6c', hair: '#28343b', style: 'close' },
  mira: { jacket: '#397c71', trim: '#a9dbcb', skin: '#c99c7b', hair: '#4a3436', style: 'long' },
};
const fallback: PortraitPalette = {
  jacket: '#536f7d', trim: '#bdcbd0', skin: '#c19a7d', hair: '#35414a', style: 'close',
};

export function GroundCrewPortrait({officerId}:{officerId:string}){
  const portrait = portraits[officerId] ?? fallback;
  return <svg data-testid={'ground-crew-portrait-art-'+officerId}
    viewBox="0 0 36 42" preserveAspectRatio="xMidYMid slice"
    focusable="false" aria-hidden="true"
    style={{display:'block',width:'100%',height:'100%'}}>
    <rect width="36" height="42" rx="2" fill="#142a35"/>
    <path d="M0 28L7 23 13 27 24 24 36 29V42H0Z" fill="#254550" opacity=".65"/>
    {portrait.style==='long' && <path
      d="M9 17Q7 5 18 5Q29 4 28 18L30 32 22 29 12 29 7 32Z"
      fill={portrait.hair}/>}
    <path d="M3 42V37Q5 30 14 28H22Q31 30 33 37V42Z"
      fill={portrait.jacket} stroke="#a2b4b1" strokeWidth=".55"/>
    <path d="M13 29L18 34 23 29L18 28Z" fill="#e3e4d7"/>
    <path d="M6 42L13 31 18 34 23 31 30 42" fill="none"
      stroke={portrait.trim} strokeWidth="1.1"/>
    <path d="M15 27V30Q18 33 21 30V27" fill={portrait.skin}/>
    <ellipse cx="18" cy="17.5" rx="8" ry="10.4" fill={portrait.skin}/>
    {portrait.style==='swept' ? <path
      d="M9 18Q8 6 18 6Q28 5 27 15Q24 12 22 10Q19 16 9 18Z"
      fill={portrait.hair}/> : portrait.style==='long' ? <path
      d="M10 18Q8 6 18 6Q28 6 27 18Q24 12 20 11Q15 16 10 18Z"
      fill={portrait.hair}/> : <path
      d="M10 16Q8 7 18 7Q28 7 26 16Q22 13 18 13Q14 13 10 16Z"
      fill={portrait.hair}/>}
    <path d="M12.5 18.5H15M21 18.5H23.5" stroke="#243039"
      strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M18 20L17.5 23H19" fill="none" stroke="#6d5148" strokeWidth=".8"/>
    <path d="M15.5 25Q18 26.5 20.5 25" stroke="#784c45"
      strokeWidth=".85" fill="none" strokeLinecap="round"/>
    <path d="M2 2H9M2 2V9M34 33V40H27" fill="none"
      stroke={portrait.trim} strokeWidth=".8" opacity=".7"/>
  </svg>;
}
