# Official Zilla mark (Al, 2026-10-16): exact trace

Source PNG: zilla-logo-official-2026-10-16.png (1600x1600, transparent bg). Traced with potrace polygon mode; render-vs-source mismatch = 22 px of 2.56M (0.0009%).

Color: #C8102E (exact sample, rgb 200,16,46).

Geometry in a 1600x1600 viewBox:
- Frame: outer rounded rect x/y 80..1520, outer corner radius 80; inner opening is a SHARP square 160..1440 (stroke 80 = 5% of width). Interior transparent.
- Bolt polygon (8 points): 1000,530 1280,530 920,780 1140,780 580,1090 320,1090 720,860 520,860
- White bars (#FFFFFF, part of the mark): x 320..1280, y 360..500 and y 1120..1260.

Canonical SVG (zilla-logo-official.svg):
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" role="img" aria-label="Zilla">
  <path fill="#C8102E" fill-rule="evenodd" d="M160 80H1440A80 80 0 0 1 1520 160V1440A80 80 0 0 1 1440 1520H160A80 80 0 0 1 80 1440V160A80 80 0 0 1 160 80ZM160 160V1440H1440V160Z"/>
  <path fill="#FFFFFF" d="M320 360H1280V500H320ZM320 1120H1280V1260H320Z"/>
  <path fill="#C8102E" d="M1000 530H1280L920 780H1140L580 1090H320L720 860H520Z"/>
</svg>

Do NOT redraw, scale the bolt, or add strokes. The two white bars ARE part of the mark (earlier spec wrongly dropped them). Use these exact paths.
