// Original layered illustration. Repeated distant foliage is SVG geometry, not a WebGL scene.
export const pondPicture=`<svg class="pond-picture" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs>
 <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#c7ddce"/><stop offset="1" stop-color="#f3eac7"/></linearGradient>
 <linearGradient id="water" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#88bcb6"/><stop offset=".45" stop-color="#4a9998"/><stop offset="1" stop-color="#236e77"/></linearGradient>
 <linearGradient id="bank" x2="0" y2="1"><stop stop-color="#759875"/><stop offset="1" stop-color="#2c5951"/></linearGradient>
 <radialGradient id="light"><stop stop-color="#fff9d9" stop-opacity=".64"/><stop offset="1" stop-color="#fff9d9" stop-opacity="0"/></radialGradient>
 <g id="fir"><path d="M0 0L-45 80H-27L-64 130H-34L-80 195H80L34 130H64L27 80H45Z" fill="currentColor"/><path d="M0 65V225" stroke="#567568" stroke-width="7"/></g>
 <g id="grass"><path d="M0 0Q-16-60-26-63M0 0Q6-74 22-91M0 0Q32-45 43-46" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></g>
 <g id="flower"><path d="M0 0Q-6-28 0-51" stroke="#6b8968" stroke-width="3" fill="none"/><g fill="#f4d9ab"><ellipse cy="-56" rx="6" ry="13"/><ellipse cy="-56" rx="6" ry="13" transform="rotate(60 0 -56)"/><ellipse cy="-56" rx="6" ry="13" transform="rotate(120 0 -56)"/></g><circle cy="-56" r="5" fill="#bd8447"/></g>
 <g id="stone"><ellipse rx="37" ry="17" fill="#456b65" opacity=".18" cy="12"/><path d="M-32 5Q-39-13-13-23Q8-36 27-12L36 7Q5 22-32 5" fill="#c5bfa3"/><path d="M-30-1Q-1-27 27-12" fill="none" stroke="#e5dfc3" stroke-width="4"/></g>
</defs>
<path fill="url(#sky)" d="M0 0H1000V700H0Z"/>
<circle cx="700" cy="100" r="260" fill="url(#light)"/>
<path d="M0 160Q150 40 310 153T650 112T1000 165V320H0Z" fill="#97b3a0"/>
<g color="#7a9c8a" opacity=".75"><use href="#fir" x="35" y="12"/><use href="#fir" x="155" y="45"/><use href="#fir" x="850" y="25"/><use href="#fir" x="950" y="70"/></g>
<path d="M0 240Q200 155 420 235Q510 258 542 155L596 147Q596 273 721 234Q880 180 1000 236V700H0Z" fill="#8da27a"/>
<path d="M567 155Q549 260 588 285Q842 280 901 403Q997 598 633 643Q291 692 117 525Q12 394 261 317Q361 290 492 301Q540 236 548 157Z" fill="#b3c4a0"/>
<path d="M561 157Q553 264 591 302C804 284 956 402 854 534C762 653 359 645 174 517C14 397 266 291 502 317Q544 245 554 157Z" fill="url(#water)"/>
<path d="M554 167Q548 245 530 282M594 317Q759 316 816 371M843 504Q826 535 788 551M191 501Q317 613 586 613" stroke="#d0e3c5" stroke-width="3" fill="none" opacity=".65"/>
<ellipse cx="576" cy="380" rx="222" ry="130" fill="url(#light)"/>
<g stroke="#c2ded0" stroke-width="2" fill="none" opacity=".45"><path d="M255 408q40-9 77 0m69 26q44-7 83 0m131-69q39-7 75 0M423 529q77 12 136 0m92-61q32-7 69 0"/><ellipse cx="705" cy="526" rx="49" ry="9"/><ellipse cx="317" cy="470" rx="36" ry="6"/></g>
<path d="M0 505Q111 516 199 599Q346 697 571 677Q838 673 1000 559V700H0Z" fill="url(#bank)"/>
<path d="M0 539Q126 546 205 621M729 682Q902 649 1000 589" fill="none" stroke="#a3b083" stroke-width="7"/>
<g color="#486f59"><use href="#grass" x="878" y="450"/><use href="#grass" x="920" y="457"/><use href="#grass" x="901" y="437"/></g>
<g stroke="#856348" stroke-width="9" stroke-linecap="round"><path d="M902 379v-21M920 393v-22M885 396v-22"/></g>
<g><use href="#flower" x="151" y="460"/><use href="#flower" x="183" y="478"/><use href="#flower" x="124" y="485"/><use href="#flower" x="212" y="489"/></g>
<use href="#stone" x="252" y="578"/><use href="#stone" x="303" y="602" transform="rotate(14 303 602)"/><use href="#stone" x="803" y="593"/>
<g color="#345e4e"><use href="#grass" x="40" y="689" transform="rotate(-15 40 689)"/><use href="#grass" x="930" y="700"/><use href="#grass" x="1000" y="664"/></g>
<g fill="#b0bf8b"><path d="M97 633q-70-98-61-29q4 34 61 29M98 633q20-121 44-61q-5 45-44 61M928 673q-71-91-59-25q8 31 59 25"/></g>
<g fill="#d6bf79"><circle cx="363" cy="651" r="3"/><circle cx="382" cy="658" r="2"/><circle cx="663" cy="671" r="3"/></g>
</svg>`;
export const leafPicture=`<svg viewBox="0 0 80 60" aria-hidden="true"><ellipse cx="40" cy="44" rx="32" ry="9" fill="#174d52" opacity=".2"/><path d="M9 33Q20 0 69 12Q66 46 34 48Q15 47 9 33" fill="#d9ae58" stroke="#85682f" stroke-width="1.5"/><path d="M11 43L59 18M29 35L27 19M39 29L51 36M46 25L45 15" stroke="#886a35" fill="none" stroke-width="1.5"/></svg>`;
