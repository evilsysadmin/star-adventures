// Atmospheric geology beyond the authored colony. This is world-space
// background art, not terrain, a move target or knowledge of undiscovered
// cells. Keep it beneath all canonical polygons and the authoritative fog.
export function GroundCanyonRelief(){
  return <g data-testid="ground-canyon-relief" aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id="canyon-far-ridge" gradientUnits="userSpaceOnUse"
        x1="430" y1="140" x2="700" y2="515">
        <stop stopColor="#66524c"/>
        <stop offset=".38" stopColor="#453e42"/>
        <stop offset="1" stopColor="#152c36"/>
      </linearGradient>
      <linearGradient id="canyon-left-face" gradientUnits="userSpaceOnUse"
        x1="-60" y1="335" x2="320" y2="650">
        <stop stopColor="#8a6d58"/>
        <stop offset=".24" stopColor="#514e49"/>
        <stop offset=".68" stopColor="#293940"/>
        <stop offset="1" stopColor="#102a33"/>
      </linearGradient>
      <linearGradient id="canyon-right-face" gradientUnits="userSpaceOnUse"
        x1="906" y1="295" x2="1200" y2="680">
        <stop stopColor="#806754"/>
        <stop offset=".35" stopColor="#494647"/>
        <stop offset=".72" stopColor="#2a3b40"/>
        <stop offset="1" stopColor="#112a34"/>
      </linearGradient>
      <linearGradient id="canyon-foreground" gradientUnits="userSpaceOnUse"
        x1="490" y1="490" x2="715" y2="650">
        <stop stopColor="#4d4d46"/>
        <stop offset=".3" stopColor="#354249"/>
        <stop offset="1" stopColor="#10232e"/>
      </linearGradient>
      <radialGradient id="canyon-industrial-haze">
        <stop stopColor="#d2a56e" stopOpacity=".24"/>
        <stop offset=".45" stopColor="#b77e67" stopOpacity=".09"/>
        <stop offset="1" stopColor="#75585c" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="canyon-cold-haze">
        <stop stopColor="#80b5b7" stopOpacity=".16"/>
        <stop offset="1" stopColor="#6fa7ba" stopOpacity="0"/>
      </radialGradient>
      <pattern id="canyon-rock-grain" patternUnits="userSpaceOnUse"
        width="97" height="79">
        <path d="M3 13l18 -7 22 6M48 28l23 -5 16 8M6 57l29 -11
          M52 65l21 -3M75 43l9 -5" fill="none" stroke="#c1a38a"
          strokeWidth="1.2" opacity=".17"/>
        <path d="M20 20l7 13M61 42l-5 11M82 5l-4 8M43 71l9 8"
          fill="none" stroke="#0f2430" strokeWidth="2.2" opacity=".35"/>
        <circle cx="12" cy="35" r="1.6" fill="#d5bd95" opacity=".17"/>
        <circle cx="91" cy="68" r="1.2" fill="#d5bd95" opacity=".2"/>
      </pattern>
    </defs>
    {/* Distant plateau and receding strata: purely scenic silhouettes, not
        undiscovered map topology. They sit BEHIND every playable cell. */}
    <path d="M-72 260L4 223 62 238 120 193 181 222 231 183 286 204
      357 175 419 214 490 170 556 211 626 178 702 216 769 180
      831 200 898 174 973 214 1037 174 1110 207 1208 172
      V473H-72Z" fill="url(#canyon-far-ridge)" opacity=".65"/>
    <path d="M-72 314Q70 285 159 299T387 295Q488 311 600 286
      T814 300Q960 278 1208 302V415H-72Z" fill="#22343d"
      opacity=".71"/>
    <path d="M-72 320Q42 294 132 313T340 310Q486 306 610 318
      T832 311T1208 318" fill="none" stroke="#b58b70"
      strokeWidth="2.8" opacity=".24"/>

    {/* Left eroded gorge, faceted faces and continuous sediment seams. */}
    <path d="M-72 355L-9 338 35 348 84 326 135 355 181 343
      224 362 277 350 305 392 279 418 242 442 195 449
      169 484 116 498 75 535 10 543 -72 579Z"
      fill="url(#canyon-left-face)" stroke="#75675b" strokeWidth="2.5"/>
    <path d="M-72 355L-9 338 35 348 84 326 112 364 87 398
      38 425 -15 445 -72 455Z" fill="#88735e" opacity=".25"/>
    <path d="M84 326L135 355 181 343 224 362 277 350
      242 389 207 395 169 426 116 440 87 398Z"
      fill="#a98b6e" opacity=".15"/>
    <path d="M-72 355L-9 338 35 348 84 326 135 355 181 343
      224 362 277 350 305 392 279 418 242 442 195 449
      169 484 116 498 75 535 10 543 -72 579Z"
      fill="url(#canyon-rock-grain)"/>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-58 395L1 380 43 392 91 371 143 386 202 373
        M-40 439L13 430 67 446 122 422 181 431 237 407
        M-65 494L5 479 53 489 108 469 160 469
        M-40 535L18 517 75 524 129 499"
        stroke="#c3a186" strokeWidth="2" opacity=".42"/>
      <path d="M35 348L38 377 26 397M181 343L177 383 162 401
        M224 362L211 398 197 420M84 398L73 430 48 443
        M145 441L130 463 118 498"
        stroke="#102c35" strokeWidth="4" opacity=".48"/>
      <path d="M-22 458L33 447 88 453M0 508L52 497 101 504"
        stroke="#73908a" strokeWidth="1.4" opacity=".34"/>
    </g>

    {/* Opposing right escarpment with vertical faulting and rim lighting. */}
    <path d="M865 360L909 336 966 350 1009 323 1054 336
      1098 299 1154 319 1208 291V640H920L895 592
      878 551 904 511 868 482 885 438Z"
      fill="url(#canyon-right-face)" stroke="#7c6a5c" strokeWidth="2.6"/>
    <path d="M1009 323L1054 336 1098 299 1154 319 1208 291V421
      L1164 435 1124 407 1090 429 1060 406 1035 399Z"
      fill="#a28a6a" opacity=".22"/>
    <path d="M865 360L909 336 966 350 1009 323 1054 336
      1098 299 1154 319 1208 291V640H920L895 592
      878 551 904 511 868 482 885 438Z"
      fill="url(#canyon-rock-grain)"/>
    <path d="M889 393L926 370 969 382 1017 356 1064 373
      1106 338 1159 358 1208 338
      M885 454L932 433 977 449 1028 424 1068 451 1124 408
      1170 427 1208 402
      M886 515L934 493 991 504 1030 469 1086 492 1146 458
      1208 462M902 564L950 541 1000 553 1050 522 1107 541
      1162 511 1208 525" fill="none" stroke="#c6a587"
      strokeWidth="2" opacity=".34"/>
    <path d="M972 349L964 410 984 445 969 500 982 549
      M1098 299L1083 381 1095 429 1081 490 1090 548
      M1154 319L1145 386 1163 421 1153 492"
      fill="none" stroke="#132d36" strokeWidth="5" opacity=".56"/>
    <path d="M880 357L909 336 966 350 1009 323 1054 336
      1098 299 1154 319 1208 291" fill="none"
      stroke="#d0aa7c" strokeWidth="2.2" opacity=".42"/>

    {/* Deep foreground canyon gives the flat floating-looking island a
        geological foundation, without supplying any fake traverse surface. */}
    <path d="M-72 577L10 548 84 561 161 531 243 549
      319 515 384 538 444 511 509 541 569 506 647 535
      728 510 805 544 883 511 962 555 1038 531 1111 563
      1208 537V640H-72Z" fill="url(#canyon-foreground)"/>
    <path d="M-72 594L16 574 89 584 160 557 245 575 317 548
      388 565 446 537 509 571 571 534 646 568 728 543
      808 570 884 544 961 583 1041 555 1114 591 1208 563"
      fill="none" stroke="#8f8670" strokeWidth="3" opacity=".24"/>
    <path d="M-72 614L17 601 96 608 165 586 242 607 316 576
      391 594 448 571 512 605 575 567 650 596 724 579
      807 607 884 581 968 613 1048 586 1122 618 1208 593"
      fill="none" stroke="#132831" strokeWidth="7" opacity=".6"/>
    <ellipse cx="640" cy="426" rx="390" ry="125"
      fill="url(#canyon-industrial-haze)" opacity=".9"/>
    <ellipse cx="410" cy="547" rx="360" ry="96"
      fill="url(#canyon-cold-haze)" opacity=".7"/>
    <ellipse cx="1050" cy="490" rx="255" ry="144"
      fill="url(#canyon-cold-haze)" opacity=".56"/>
  </g>;
}
