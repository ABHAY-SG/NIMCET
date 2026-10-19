-- ============================================================================
-- NIMCET MOCK - 01 · mathematics notation fixes
--
-- Powers/subscripts that were stored as plain text (`e2x`, `4x2`, `sec2 3x`,
-- `A2`, `y1`, `s11`) are rewritten as LaTeX so KaTeX typesets them. The
-- corrected text mirrors supabase/seed/nimcet-mock-01-questions.csv.
--
-- HOW TO RUN (one paste):
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
--
-- Idempotent and non-destructive: each row is matched by its ORIGINAL stem,
-- so re-running after the fix changes nothing, and nothing is ever deleted.
-- After running once this file can be discarded.
-- ============================================================================

begin;

do $$
declare
  n int;
  total int := 0;
begin
  -- CSV row 1
  update public.questions
     set stem = $fix$The two functions of x are \(f(x) = {e^{2x}}\) and \(g(x) = \ln x\), then find \(gof(x)\).$fix$,
         options = jsonb_build_array($fix$\(x\)$fix$, $fix$\(2x\)$fix$, $fix$\({e^x}\)$fix$, $fix$\(\ln x\)$fix$),
         explanation = $fix$Given \(f(x) = {e^{2x}}\) and \(g(x) = \ln x\)
\(gof(x) = g(f(x))\)
\(gof(x) = g({e^{2x}})\)
\(gof(x) = \ln {e^{2x}}\)
\(gof(x) = 2x\ln e\)
\(gof(x) = 2x\)   (∵ \(\ln e = 1\))$fix$
   where stem = $fix$The 2 function in x are f(x) = e2x and g(x) = ln x then find gof(x) is$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 1: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 2
  update public.questions
     set stem = $fix$Find the equation of a line having a slope of \(-2\) and passing through the intersection of \(2x - y = 1\) and \(x + 2y = 3\).$fix$,
         options = jsonb_build_array($fix$\(y - 2x + 1 = 0\)$fix$, $fix$\(y + 2x - 3 = 0\)$fix$, $fix$\(2y - x - 3 = 0\)$fix$, $fix$\(2y + x + 1 = 0\)$fix$),
         explanation = $fix$Given lines are:
\(2x - y = 1\;\;...(i)\)
\(x + 2y = 3\;\;...(ii)\)
Adding \(2 \times (i)\) to (ii)
\( \Rightarrow 5x = 5\)
\( \Rightarrow x = 1\)
Putting the value of \(x\) in (i)
\(2(1) - y = 1\)
\( \Rightarrow y = 1\)
The intersection point is \((1,\,1)\).
The line has slope \(-2\) and passes through \((1,\,1)\).
∴ Equation of the line is
\(y - {y_1} = m(x - {x_1})\)
\( \Rightarrow y - 1 = - 2(x - 1)\)
\( \Rightarrow y + 2x - 3 = 0\)$fix$
   where stem = $fix$Find the equation of a line having a slope of -2 and passes through the intersection if 2x - y = 1 and x + 2y = 3$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 2: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 3
  update public.questions
     set options = jsonb_build_array($fix$\(8{\sec ^2}3x\tan 3x\)$fix$, $fix$\(24{\sec ^2}3x\tan 3x\)$fix$, $fix$\(\frac{4}{3}{\sec ^2}3x\)$fix$, $fix$\(4{\sec ^2}3x\)$fix$)
   where stem = $fix$If \(y = \frac{{12\tan x\; - \;4{{\tan }^3}x}}{{9\; - \;27{{\tan }^2}x}}\) then find \(\frac{{{d^2}y}}{{d{x^2}}}\) ?$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 3: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 5
  update public.questions
     set stem = $fix$Which of the following is the roster form of the set \(A = \{ 4{x^2} - x - 5 = 0:x \in I\}\) ?$fix$,
         options = jsonb_build_array($fix$\(\{ 1,\, - 1.25\}\)$fix$, $fix$\(\{ 1\}\)$fix$, $fix$\(\{ - 1,\,1.25\}\)$fix$, $fix$\(\{ - 1\}\)$fix$),
         explanation = $fix$Given: \(A = \{ 4{x^2} - x - 5 = 0:x \in I\}\)
\(4{x^2} - x - 5 = 0\)
\( \Rightarrow (x + 1)(4x - 5) = 0\)
\( \Rightarrow x = - 1,\,1.25\)
For the set \(A\), \(x \in I\)
∴ Roster form of set \(A = \{ - 1\}\)$fix$
   where stem = $fix$Which of the following is the roster form of the set A = {4x2 - x - 5 = 0 : x ∈ I}$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 5: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 7
  update public.questions
     set stem = $fix$If the integrating factor of \(x(1 - {x^2})\,dy + (2{x^2}y - y - a{x^3})\,dx = 0\) is \({e^{\int {Pdx} }}\), then \(P\) is equal to$fix$,
         explanation = $fix$Given, \(x(1 - {x^2})\,dy + (2{x^2}y - y - a{x^3})\,dx = 0\)
\( \Rightarrow x(1 - {x^2})\frac{{dy}}{{dx}} + (2{x^2}y - y - a{x^3}) = 0\)
\( \Rightarrow x(1 - {x^2})\frac{{dy}}{{dx}} + (2{x^2} - 1)y = a{x^3}\)
\(\frac{{dy}}{{dx}} + \frac{{2{x^2} - 1}}{{x(1 - {x^2})}}y = \frac{{a{x^3}}}{{x(1 - {x^2})}}\)
Comparing with \(\frac{{dy}}{{dx}} + Py = Q\), we get \(P = \frac{{2{x^2} - 1}}{{x(1 - {x^2})}}\)$fix$
   where stem = $fix$If integrating factor of x(1 - x2) dy + (2x2y - y - ax3) dx = 0 is \({e^{\int {Pdx} }}\), then P is equal to$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 7: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 11
  update public.questions
     set explanation = $fix$Given: \(\rm \sqrt y = \sin x + \cos x\)
To find: \(\rm \dfrac{{dy}}{{dx}}\)
\(\rm \sqrt y = \sin x + \cos x\)
Squaring both sides, we get
\( \Rightarrow y = {(\sin x + \cos x)^2}\)
\( \Rightarrow y = {\sin ^2}x + {\cos ^2}x + 2\sin x\cos x\)
\( \Rightarrow y = 1 + \sin 2x\)   (∵ \(2\sin x\cos x = \sin 2x\))
Differentiating with respect to \(x\), we get
\(\rm \dfrac{{dy}}{{dx}} = 0 + 2\cos 2x = 2\cos 2x\)$fix$
   where stem = $fix$If \(\rm \sqrt y\) = sin x + cos x then \(\rm \dfrac {dy}{dx}\) is$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 11: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 14
  update public.questions
     set explanation = $fix$Here we have to find the value of \(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx\)
Let \(\tan x = t\), then \({\sec ^2}x\,dx = dt\)
\(\Rightarrow \smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx = \;\smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }}\)
Now by comparing \(\;\smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }}\) with \(\smallint \frac{{dx}}{{\sqrt {{x^2} + {a^2}} }}\) we get, a = 4
As we know that, \(\smallint \frac{{dx}}{{\sqrt {{x^2} + {a^2}} }} = \log \left| {x + \sqrt {{x^2} + {a^2}} } \right| + C\) where C is a constant
\(\Rightarrow \smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }} = \log \left| {t + \sqrt {{t^2} + 16} } \right| + C\)
Now by substituting tan x = t in the above equation we get,
\(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx = \;\log \left| {\tan x + \sqrt {16 + {{\tan }^2}x} \;} \right| + C\) where C is a constant$fix$
   where stem = $fix$Evaluate: \(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx\)$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 14: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 16
  update public.questions
     set stem = $fix$Let \(R = \{ (a,\,b):a,\,b \in N\) and \({a^2} = b\}\), then what is the relation \(R\) ?$fix$,
         explanation = $fix$Here, \(R = \{ (a,\,b):a,\,b \in N\) and \({a^2} = b\}\)
1. Relation \(R\) is not reflexive since \(2 \ne {2^2}\).
2. Since \({2^2} = 4\), so \((2,\,4)\) belongs to \(R\).
But \(4 \ne 2\), so \(R\) is not symmetric.
3. Since \({4^2} = 16\), so \((4,\,16)\) belongs to \(R\).
Also, \({16^2} = 256\), so \((16,\,256)\) belongs to \(R\).
But \({4^2} \ne 256\), so \(R\) is not transitive.
So, \(R\) satisfies none of reflexivity, symmetry and transitivity.
Hence, option D is correct.$fix$
   where stem = $fix$Let, R = {(a, b): a, b ϵ N and a2 = b}, then what is the relation R$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 16: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 28
  update public.questions
     set explanation = $fix$Let \(A\) be the event that the man reports that number four is obtained.
Let \(E_1\) be the event that four is obtained and \(E_2\) be its complementary event.
Then, \(P(E_1)\) = Probability that four occurs = \(1/6\)
\(P(E_2)\) = Probability that four does not occur = \(1 - P(E_1) = 1 - 1/6 = 5/6\)
Also, \(P(A|E_1)\) = Probability that the man reports four and it is actually a four = \(2/3\)
\(P(A|E_2)\) = Probability that the man reports four and it is not a four = \(1/3\)
By using Bayes' theorem, the probability that the number obtained is actually a four:
\(P\left( {E_1|A} \right) = \frac{{P\left( {E_1} \right)P(A|E_1)}}{{P\left( {E_1} \right)P\left( {A|E_1} \right) + P\left( {E_2} \right)P(A|E_2)}}\)
\( \Rightarrow P\left( {E_1|A} \right) = \frac{{1/6 \times 2/3}}{{1/6 \times 2/3 + 5/6 \times 1/3}} = 2/7\)$fix$
   where stem = $fix$A man is known to speak truth 2 out of 3 times. He throws a die and reports that number obtained is a four. Find the probability that the number obtained is actually a four.$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 28: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 34
  update public.questions
     set stem = $fix$If the third term in the binomial expansion of \({(1 + x)^m}\) is \((-1/8){x^2}\), then the rational value of \(m\) is$fix$,
         explanation = $fix$Given: the third term in the binomial expansion of \({(1 + x)^m}\) is \((-1/8){x^2}\)
\(\rm (1+x)^m= 1+mx+\frac{m(m-1)}{2!}x^2+\frac{m(m-1)(m-2)}{3!}x^3 +....\)
So, the third term in the binomial expansion of \({(1 + x)^m}\) is \(\rm \frac{m(m-1)}{2!}x^2\)
\(\rm \frac{m(m-1)}{2!}x^2\) = \((-1/8){x^2}\)
\( \Rightarrow \rm \frac{m(m-1)}{2}= \frac {-1}{8}\)
\( \Rightarrow 4{m^2} - 4m + 1 = 0\)
\( \Rightarrow {(2m - 1)^2} = 0\)
\( \Rightarrow 2m - 1 = 0\)
∴ \(m = \frac 12\)$fix$
   where stem = $fix$If the third term in the binomial expansion of (1 + x)m is (-1/8)x² then the rational value of m is$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 34: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 35
  update public.questions
     set stem = $fix$If the sequence \(\{ {s_n}\} \) is a geometric progression and \({s_2}{s_{11}} = {s_p}{s_8}\), then what is the value of \(p\) ?$fix$,
         explanation = $fix$Given: \({s_2}{s_{11}} = {s_p}{s_8}
The sequence \(\{ {s_n}\} \) is a geometric progression.
As we know, the \({n^{th}}\) term of a GP is \(a{r^{n - 1}}\).
So, \({s_2} = a{r^{2 - 1}} = ar\)
\({s_{11}} = a{r^{11 - 1}} = a{r^{10}}\)
\({s_p} = a{r^{p - 1}}\)
\({s_8} = a{r^{8 - 1}} = a{r^7}\)
Now,
\({s_2}{s_{11}} = {s_p}{s_8}\)
\( \Rightarrow ar \cdot a{r^{10}} = a{r^{p - 1}} \cdot a{r^7}\)
\( \Rightarrow {r^{11}} = {r^{p + 6}}\)
\( \Rightarrow 11 = p + 6\)
∴ \(p = 5\)$fix$
   where stem = $fix$If the sequence {sn} is a geometric progression and s2 s11 = sp s8, then what is the value of p?$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 35: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 43
  update public.questions
     set stem = $fix$Find the radius of the circle \(5{x^2} + 5{y^2} - 20x - 6y + 15 = 0\).$fix$,
         explanation = $fix$Given equation of the circle is \(5{x^2} + 5{y^2} - 20x - 6y + 15 = 0\)
\( \Rightarrow {x^2} + {y^2} - 4x - \frac{6}{5}y + 3 = 0\;\;...(i)\)
On comparing eq. (i) with the standard equation of a circle \({x^2} + {y^2} + 2gx + 2fy + c = 0\),
we get \(g = - 2\), \(f = \frac{{ - 3}}{5}\) and \(c = 3\).
As we know, radius of the circle \( = \sqrt {{g^2} + {f^2} - c} \)
\( \Rightarrow r = \sqrt {{{( - 2)}^2} + {{\left( {\frac{{ - 3}}{5}} \right)}^2} - 3} = \sqrt {4 + \frac{9}{{25}} - 3} \)
\( \Rightarrow r = \frac{{\sqrt {34} }}{5}\) units.
Hence, option A is correct.$fix$
   where stem = $fix$Find the radius of the circle , 5x2 + 5y2 - 20x - 6y + 15 = 0$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 43: no question matched (already fixed?)'; end if;
  total := total + n;

  -- CSV row 44
  update public.questions
     set stem = $fix$If \(A\) is a skew symmetric matrix, then \({A^2}\) is a$fix$,
         options = jsonb_build_array($fix$null matrix$fix$, $fix$unitary matrix$fix$, $fix$skew symmetric$fix$, $fix$symmetric$fix$),
         explanation = $fix$For a skew symmetric matrix \(A\), \({A^T} = - A\).
Then \({({A^2})^T} = {({A^T})^2} = {( - A)^2} = {A^2}\).
Hence, \({A^2}\) is a symmetric matrix.$fix$
   where stem = $fix$If A is skew symmetric matrix, then A2 is a$fix$;
  get diagnostics n = row_count;
  if n = 0 then raise warning 'CSV row 44: no question matched (already fixed?)'; end if;
  total := total + n;

  raise notice 'NIMCET MOCK - 01 math fix: % question row(s) updated.', total;
end $$;

commit;

-- Verification: questions still holding plain-text notation (expect none for
-- NIMCET MOCK - 01; rows from other mocks show what still needs authoring).
select id, topic, left(stem, 80) as stem
  from public.questions
 where stem ~ '[A-Za-z][0-9]'
 order by topic, stem
 limit 50;
