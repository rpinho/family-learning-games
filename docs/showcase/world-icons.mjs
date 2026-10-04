// Small original storybook tools; household cut-outs stay in the private art library.
const paths={
 rope:'<ellipse cx="30" cy="29" rx="19" ry="15"/><ellipse cx="30" cy="29" rx="12" ry="9"/><path d="M13 39q-10 12 0 17m34-17q11-2 7-18"/>',
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
