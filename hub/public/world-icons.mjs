// Small original storybook tools; household cut-outs stay in the private art library.
const paths={
 book:'<path d="M7 12q13-5 23 2 10-7 23-2v39q-13-5-23 2-10-7-23-2Z" fill="#b7d5c3"/><path d="M30 14v39M12 23h11m-11 8h11m-11 8h11m14-16h10m-10 8h10m-10 8h10"/>',
 badge:'<path d="M15 8h30l5 28q-8 16-20 23Q18 52 10 36Z" fill="#e4bd68"/><circle cx="30" cy="29" r="13" fill="#d7e2de"/><path d="M30 20v21m-9-9q9 17 18 0m-14-7h10"/>',
 gem:'<path d="m8 25 13-16h19l14 16-23 32Z" fill="#9ccfdd"/><path d="M8 25h46M21 9l-3 16 13 32 13-32-4-16m-22 16h26"/>',
 balance:'<path d="M8 44 17 17l24-5 13 21-7 20-28 5Z" fill="#a7c6ac"/><path d="M20 29h22m-22 11h22" stroke-width="4"/>',
 rock:'<path d="m7 43 9-27 23-7 15 26-8 19-26 3Z" fill="#aabac9"/><path d="m16 16 14 13 9-20M7 43l23-14 16 25" stroke="#768d9f"/>',
 rope:'<path d="M53 37q10 6 5 17" stroke-width="4"/><path d="m56 52-2 6m4-6 1 6m1-7 3 4" stroke-width="2"/><ellipse cx="31" cy="41" rx="23" ry="12" fill="#d8ae6b"/><ellipse cx="31" cy="33" rx="21" ry="11" fill="#e2bd7c"/><ellipse cx="31" cy="25" rx="18" ry="9.5" fill="#ecca8c"/><ellipse cx="31" cy="25" rx="8" ry="4" fill="#8f6b3a"/><path d="M12 43l3-5m4 8 3-5m5 6 3-5m5 5 3-5m5 4 3-5m5 2 2-4M14 35l3-5m4 7 3-5m5 6 3-5m5 5 3-5m5 3 3-4M17 27l3-4m4 6 3-5m5 5 3-4m5 3 3-4" stroke="#9b7444" stroke-width="1.6"/>',
 lantern:'<path d="M24 13v-4q6-9 12 0v4M19 16h22l5 36H14Z" fill="#e6bd68"/><path d="M19 25h22v20H19Z" fill="#fff2a2"/><path d="M30 28v14M14 53h32"/>',
 net:'<path d="m13 56 17-26"/><ellipse cx="37" cy="20" rx="17" ry="13" fill="#b6d5cf"/><path d="m24 13 27 13m-29-6 23 13m-17-22 1 20m8-22 1 23m7-21 1 18" stroke-width="1"/>',
 shovel:'<path d="M25 6h12v12H25Z" fill="#b89261"/><path d="M31 18v23"/><path d="M20 39h22v9q-3 10-11 13-8-3-11-13Z" fill="#a8babc"/>',
 key:'<circle cx="19" cy="18" r="12"/><path d="m27 27 25 25m-8-8-8 8m0-16-8 8"/>',
 scope:'<path d="m10 43 30-31 13 13-30 30Z" fill="#c79f60"/><path d="m35 10 20 20M7 40l20 20"/>',
 ball:'<circle cx="32" cy="32" r="23" fill="#f3efe3"/><path d="m24 17 16 0 6 16-14 10-14-10Z" fill="#596267"/><path d="M25 17 19 12m21 5 7-5m-1 21 9 3M32 43v12m-14-22-10 3"/>',
 acorn:'<path d="M18 28q0 23 14 29 14-6 14-29Z" fill="#bd9159"/><path d="M14 28q1-23 18-23t18 23Z" fill="#806840"/><path d="M31 8q0-8 8-6"/>',
 bush:'<path d="M6 50q-7-18 8-22-5-15 10-17 9-15 19 0 16-3 13 14 17 9 1 25Z" fill="#7b9955"/>',
 map:'<path d="m7 13 17-5 16 7 17-5v42l-17 5-16-7-17 5Z" fill="#e8d4a4"/><path d="M24 8v42m16-35v42M13 41q20-33 36-13" stroke-dasharray="4 3"/>',
 star:'<path d="m32 6 7 18 20 1-15 13 5 21-17-12-17 12 5-21L5 25l20-1Z" fill="#e9c86b"/>',
 bridge:'<path d="M4 46h22m12 0h22M7 43V21m49 22V21M7 22q12 12 22 8m9 0q9 4 18-8"/><path d="M23 39 29 52m6-13-6 13"/>',
 x:'<ellipse cx="32" cy="43" rx="29" ry="16" fill="#d3ba87"/><path d="m17 32 30 23m0-23-30 23" stroke="#ab5542" stroke-width="7"/>',
 shell:'<path d="m31 54-22-29q23-32 46 0L33 54Z" fill="#e6b6a2"/><path d="M31 54V9m0 45L18 14m13 40 14-40"/>',
 flag:'<path d="M17 58V6m0 2h36l-9 10 9 10H17Z" fill="currentColor"/>',
 branch:'<path d="M7 60V8m0 12q20 5 41-12m-30 16 8 14"/><circle cx="30" cy="42" r="12" fill="#f3efe3"/>',
 chest:'<path d="M7 26q0-19 25-19t25 19v30H7Z" fill="#bb8e52"/><path d="M7 27h50M15 13v43m34-43v43"/><path d="M27 26h10v15H27Z" fill="#edd183"/>'
};
export const icon=id=>`<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#685331" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths[id]||paths.map}</svg>`;
