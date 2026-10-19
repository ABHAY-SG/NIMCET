-- ============================================================================
-- NIMCET MOCK - 01 · generated from nimcet-mock-01-questions.csv by scripts/import-mock-csv.mjs
-- DO NOT EDIT BY HAND — fix the CSV and regenerate instead.
--
-- HOW TO RUN (one paste):
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Idempotent and non-destructive: re-running never duplicates questions (rows
-- are matched by exact stem), never deletes anything, and simply rebuilds the
-- target test's question list in CSV order. Run the verification selects at
-- the end to see the imported totals.
--
-- Untouched on purpose: the test's minutes, sections, description and
-- published/free flags — only question_ids is rewritten.
-- ============================================================================

begin;

-- 1. Schema safety: tests.sections is additive (see supabase/migrations/0006_test_sections.sql).
alter table public.tests
  add column if not exists sections jsonb not null default '[]'::jsonb;

-- 2. Stage the CSV rows (ordered by seq = CSV order).
drop table if exists pg_temp.seed_import;
create temporary table seed_import (
  seq         int primary key,
  exam        text not null,
  section     text not null,
  topic       text not null,
  difficulty  text not null,
  stem        text not null,
  options     jsonb not null,
  answer      int  not null,
  explanation text not null,
  plus        numeric not null,
  minus       numeric not null
) on commit drop;

insert into seed_import (seq, exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus) values
  (1, 'nimcet', 'maths', 'Function and Relation', 'Easy', 'The two functions of x are \(f(x) = {e^{2x}}\) and \(g(x) = \ln x\), then find \(gof(x)\).', jsonb_build_array('\(x\)', '\(2x\)', '\({e^x}\)', '\(\ln x\)'), 1, 'Given \(f(x) = {e^{2x}}\) and \(g(x) = \ln x\)
\(gof(x) = g(f(x))\)
\(gof(x) = g({e^{2x}})\)
\(gof(x) = \ln {e^{2x}}\)
\(gof(x) = 2x\ln e\)
\(gof(x) = 2x\)   (∵ \(\ln e = 1\))', 12, -3),
  (2, 'nimcet', 'maths', 'Line', 'Easy', 'Find the equation of a line having a slope of \(-2\) and passing through the intersection of \(2x - y = 1\) and \(x + 2y = 3\).', jsonb_build_array('\(y - 2x + 1 = 0\)', '\(y + 2x - 3 = 0\)', '\(2y - x - 3 = 0\)', '\(2y + x + 1 = 0\)'), 1, 'Given lines are:
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
\( \Rightarrow y + 2x - 3 = 0\)', 12, -3),
  (3, 'nimcet', 'maths', 'Differentiability', 'Easy', 'If \(y = \frac{{12\tan x\; - \;4{{\tan }^3}x}}{{9\; - \;27{{\tan }^2}x}}\) then find \(\frac{{{d^2}y}}{{d{x^2}}}\) ?', jsonb_build_array('\(8{\sec ^2}3x\tan 3x\)', '\(24{\sec ^2}3x\tan 3x\)', '\(\frac{4}{3}{\sec ^2}3x\)', '\(4{\sec ^2}3x\)'), 0, 'Given: \(y = \frac{{12\tan x\; - \;4{{\tan }^3}x}}{{9\; - \;27{{\tan }^2}x}}\)
To find: \(\frac{{{d^2}y}}{{d{x^2}}}\)
\(y = \frac{{12\tan x\; - \;4{{\tan }^3}x}}{{9 - 27{{\tan }^2}x}}\)
\(\Rightarrow y = \frac{{4\left( {3\tan x - {{\tan }^3}x} \right)}}{{9\left( {1\; - \;3{{\tan }^2}x} \right)}}\)
We know that, \(\tan 3x = \frac{{3\tan x\; - \;{{\tan }^3}x}}{{1\; - \;3{{\tan }^2}x}}\) 
\(\Rightarrow y = \frac{4}{9}\tan 3x\)
Differentiation to both sides w.r.t x
\(\Rightarrow \frac{{dy}}{{dx}} = \frac{4}{9}{\sec ^2}3x \times 3\)
\(\Rightarrow \frac{{dy}}{{dx}} = \frac{4}{3}{\sec ^2}3x\)
Again differentiating w.r.t x
\(\Rightarrow \frac{{{d^2}y}}{{d{x^2}}} = \frac{4}{3} \times 2 \times \sec 3x \times \tan 3x \times \sec 3x \times 3\)
\(\Rightarrow \frac{{{d^2}y}}{{d{x^2}}} = 8{\sec ^2}3x\tan 3x\)', 12, -3),
  (4, 'nimcet', 'maths', 'Statistics', 'Easy', 'If the standard deviation and mean some observations are 6.5 and 12.5 respectively then find the coefficient of variation for the same observations ?', jsonb_build_array('52%', '23%', '35%', 'None of these'), 0, 'For some observations we have mean is 12.5 and standard deviation is 6.5. 
Here, we have to find the coefficient of variation for the same observations. 
As we know, 
Coefficient of variation = \(\frac{\text{standard deviation}}{\text{mean}}\) × 100 
→ Coefficient of variation = \(\frac{6.5}{12.5}\) × 100 = 52%', 12, -3),
  (5, 'nimcet', 'maths', 'Sets', 'Easy', 'Which of the following is the roster form of the set \(A = \{ 4{x^2} - x - 5 = 0:x \in I\}\) ?', jsonb_build_array('\(\{ 1,\, - 1.25\}\)', '\(\{ 1\}\)', '\(\{ - 1,\,1.25\}\)', '\(\{ - 1\}\)'), 3, 'Given: \(A = \{ 4{x^2} - x - 5 = 0:x \in I\}\)
\(4{x^2} - x - 5 = 0\)
\( \Rightarrow (x + 1)(4x - 5) = 0\)
\( \Rightarrow x = - 1,\,1.25\)
For the set \(A\), \(x \in I\)
∴ Roster form of set \(A = \{ - 1\}\)', 12, -3),
  (6, 'nimcet', 'maths', 'Matrices', 'Easy', 'If \(\rm A=\begin{bmatrix}0 & \rm -i \\ \rm i & \ \ \ 0 \end{bmatrix}\) and \(\rm B=\begin{bmatrix}1 & \ \ \ 0 \\ 0 & -1 \end{bmatrix}\) are matrices, then AB + BA is:', jsonb_build_array('a diagonal matrix', 'an invertible matrix', 'a unit matrix', 'a null matrix'), 3, 'Given: \(\rm A=\begin{bmatrix}0 & \rm -i \\ \rm i & \ \ \ 0 \end{bmatrix}\)and \(\rm B=\begin{bmatrix}1 & \ \ \ 0 \\ 0 & -1 \end{bmatrix}\)
 \(\rm AB=\begin{bmatrix}0 & \rm -i \\ \rm i & \ \ \ 0 \end{bmatrix}\times\begin{bmatrix}1 & \ \ \ 0 \\ 0 & -1 \end{bmatrix}=\begin{bmatrix}0+0& 0+\rm i \\ \rm i+0 & 0+0 \end{bmatrix}=\begin{bmatrix}0 & \rm i \\ \rm i & 0 \end{bmatrix}\)
And \(\rm BA=\begin{bmatrix}1 & \ \ \ 0 \\ 0 & -1 \end{bmatrix}\times\begin{bmatrix}0 & \rm -i \\ \rm i & \ \ \ 0 \end{bmatrix}=\begin{bmatrix}0+0& \rm -i+0 \\ 0-\rm i &\ \ \ 0+0 \end{bmatrix}=\begin{bmatrix}\ \ \ 0 & \rm -i \\ \rm -i &\ \ \ 0 \end{bmatrix}\)
\(\rm \therefore AB+BA=\begin{bmatrix}0 & \rm i \\ \rm i & 0 \end{bmatrix}+\begin{bmatrix}\ \ \ 0 & \rm -i \\ \rm -i &\ \ \ 0 \end{bmatrix}=\begin{bmatrix}0+0 & \rm i-i\\ \rm i-i & 0+0 \end{bmatrix}=\begin{bmatrix}0 & 0\\ 0 & 0 \end{bmatrix}\)', 12, -3),
  (7, 'nimcet', 'maths', 'Differential Equations', 'Medium', 'If the integrating factor of \(x(1 - {x^2})\,dy + (2{x^2}y - y - a{x^3})\,dx = 0\) is \({e^{\int {Pdx} }}\), then \(P\) is equal to', jsonb_build_array('\(\frac{{2{x^2} - a{x^3}}}{{x(1 - {x^2})}}\)', '\(2x^3-1\)', '\(\frac{{2{x^2} - 1}}{{a{x^3}}}\)', '\(\frac{{2{x^2} - 1}}{{x(1 - {x^2})}}\)'), 3, 'Given, \(x(1 - {x^2})\,dy + (2{x^2}y - y - a{x^3})\,dx = 0\)
\( \Rightarrow x(1 - {x^2})\frac{{dy}}{{dx}} + (2{x^2}y - y - a{x^3}) = 0\)
\( \Rightarrow x(1 - {x^2})\frac{{dy}}{{dx}} + (2{x^2} - 1)y = a{x^3}\)
\(\frac{{dy}}{{dx}} + \frac{{2{x^2} - 1}}{{x(1 - {x^2})}}y = \frac{{a{x^3}}}{{x(1 - {x^2})}}\)
Comparing with \(\frac{{dy}}{{dx}} + Py = Q\), we get \(P = \frac{{2{x^2} - 1}}{{x(1 - {x^2})}}\)', 12, -3),
  (8, 'nimcet', 'maths', 'Indefinite Integrals', 'Medium', 'Evaluate: \(\smallint \frac{{dx}}{{x\left\{ {6 \cdot {{\left( {\log x} \right)}^2} + 7\log x + 2} \right\}}}\)', jsonb_build_array('\(\log \left| {\frac{{2\log x - 1}}{{3\log x + 2}}} \right| + C\)', '\(\log \left| {\frac{{2\log x + 1}}{{3\log x - 2}}} \right| + C\)', '\(\log \left| {\frac{{2\log x + 1}}{{3\log x + 2}}} \right| + C\)', '\(\log \left| {\frac{{2\log x - 1}}{{3\log x - 2}}} \right| + C\)'), 2, 'Here we have to find the value of \(\smallint \frac{{dx}}{{x\left\{ {6 \cdot {{\left( {\log x} \right)}^2} + 7\log x + 2} \right\}}}\)
Let log x = t and dx/x = dt
\(⇒ \smallint \frac{{dx}}{{x\left\{ {6 \cdot {{\left( {\log x} \right)}^2} + 7\log x + 2} \right\}}} = \;\smallint \frac{{dt}}{{\left( {6{t^2} + 7t + 2} \right)}}\)
\(⇒ \smallint \frac{{dt}}{{\left( {6{t^2} + 7t + 2} \right)}} = \;\smallint \frac{{dt}}{{\left( {2t + 1} \right)\left( {3t + 2} \right)}}\)
\(⇒ \frac{1}{{\left( {2t + 1} \right)\left( {3t + 2} \right)}} = \frac{A}{{2t + 1}} + \frac{B}{{3t + 2}}\)
⇒ 1 = A (3t + 2) + B (2t + 1) --------(1)
By putting t = - 1/2 on both the sides of (1) we get A = 2
By putting t = - 2/3 on both the sides of (1) we get B = - 3
\(\Rightarrow \frac{1}{{\left( {2t + 1} \right)\left( {3t + 2} \right)}} = \frac{2}{{2t + 1}} - \frac{3}{{3t + 2}}\)
\(\;\Rightarrow \smallint \frac{{dt}}{{\left( {2t + 1} \right)\left( {3t + 2} \right)}} = \;\smallint \frac{{2}}{{2t + 1}}dt - \;\smallint \frac{{3dt}}{{3t + 2}}\)
As we know that \(\smallint \frac{{dx}}{x} = \log \left| x \right|\; + C\) where C is a constant
\(\Rightarrow \;\smallint \frac{{dt}}{{\left( {2t + 1} \right)\left( {3t + 2} \right)}} = \log \left| {2t + 1} \right| - \log \left| {3t + 2} \right| + C\)
\(= \log \left| {\frac{{2t + 1}}{{3t + 2}}} \right| + C\)
By substituting log x = t in the above equation we get
\(\Rightarrow \smallint \frac{{dx}}{{x\left\{ {6 \cdot {{\left( {\log x} \right)}^2} + 7\log x + 2} \right\}}} = \;\log \left| {\frac{{2\log x + 1}}{{3\log x + 2}}} \right| + C\)', 12, -3),
  (9, 'nimcet', 'maths', 'Line', 'Easy', 'XY-plane divides the line joining the points A(2, 3, -5) and B(-1, -2, -3) in the ratio', jsonb_build_array('2 ∶ 1 internally', '3 ∶ 2 externally', '5 ∶ 3 internally', '5 ∶ 3 externally'), 3, 'Let XY plane divides the line joining the points A(2, 3, -5) and B(-1, -2, -3) in the ratio k : 1
Using the section formula, the coordinate of the point of intersection is given by
\(\rm \left(\frac{-k+2}{k+1},\frac{-2k+3}{k+1},\frac{-3k-5}{k+1} \right )\)
As we know, on the XY plane z-coordinate is zero.
Therefore, \(\rm \frac{-3k-5}{k+1} = 0\)
⇒ -3k - 5 = 0
⇒ -3k = 5
\(\rm \Rightarrow \frac{k}{1} = \frac{-5}{3}\)
Therefore, the ratio is 5 : 3 externally', 12, -3),
  (10, 'nimcet', 'maths', 'Matrices', 'Easy', 'A = \(\begin{bmatrix} 1& -1 &0 \\ 3& 2 & -1 \end{bmatrix}\) and B = \(\begin{bmatrix} 1 \\ 3\\ 5 \end{bmatrix}\), find (AB)T', jsonb_build_array('\(\begin{bmatrix} -2 \\ 4 \end{bmatrix}\)', '\(\begin{bmatrix} -2 & 4 \end{bmatrix}\)', '\(\begin{bmatrix} 2 \\ -4 \end{bmatrix}\)', '\(\begin{bmatrix} -2 &- 4 \end{bmatrix}\)'), 1, 'Given A = \(\begin{bmatrix} 1& -1 &0 \\ 3& 2 & -1 \end{bmatrix}\) and B = \(\begin{bmatrix} 1 \\ 3\\ 5 \end{bmatrix}\)
AB = \(\begin{bmatrix} 1& -1 &0 \\ 3& 2 & -1 \end{bmatrix}\) × \(\begin{bmatrix} 1 \\ 3\\ 5 \end{bmatrix}\)
AB = \(\begin{bmatrix} 1-3+0 \\ 3+6-5 \end{bmatrix}\)
AB = \(\begin{bmatrix} -2 \\ 4 \end{bmatrix}\)
∴ (AB)T = \(\begin{bmatrix} -2 & 4 \end{bmatrix}\)', 12, -3),
  (11, 'nimcet', 'maths', 'Differentiability', 'Easy', 'If \(\rm \sqrt y\) = sin x + cos x then \(\rm \dfrac {dy}{dx}\) is', jsonb_build_array('2 sin 2x', '2 cos 2x', 'cos x - sin x', 'None of the above'), 1, 'Given: \(\rm \sqrt y = \sin x + \cos x\)
To find: \(\rm \dfrac{{dy}}{{dx}}\)
\(\rm \sqrt y = \sin x + \cos x\)
Squaring both sides, we get
\( \Rightarrow y = {(\sin x + \cos x)^2}\)
\( \Rightarrow y = {\sin ^2}x + {\cos ^2}x + 2\sin x\cos x\)
\( \Rightarrow y = 1 + \sin 2x\)   (∵ \(2\sin x\cos x = \sin 2x\))
Differentiating with respect to \(x\), we get
\(\rm \dfrac{{dy}}{{dx}} = 0 + 2\cos 2x = 2\cos 2x\)', 12, -3),
  (12, 'nimcet', 'maths', 'Trigonometric Equations', 'Medium', 'Find the principal solution of the equation sec x = 2 ?', jsonb_build_array('\(\pi/2\)', '\(\pi/3\)', '\(5\pi/3\)', 'Both B and C'), 3, 'The given equation is:
\[
\sec x = 2
\]
Since \(\sec x = \frac{1}{\cos x}\), we rewrite the equation as:
\[
\frac{1}{\cos x} = 2
\]
\[
\cos x = \frac{1}{2}
\]
From trigonometric values, we know:
\[
\cos x = \frac{1}{2} \quad \text{at} \quad x = \frac{\pi}{3}, \quad \frac{5\pi}{3}
\]
The principal solutions are:
\[
x = \frac{\pi}{3}, \quad \frac{5\pi}{3}
\]', 12, -3),
  (13, 'nimcet', 'maths', 'Differentiation', 'Medium', 'Find the derivative of \( \frac{1}{3x^2} \) with respect to \( x \)?', jsonb_build_array('\( -\frac{6}{x^3} \)', '\( -\frac{1}{x^3} \)', '\( -\frac{2}{3x^3} \)', '\( -\frac{1}{6x^3} \)'), 2, 'Find the derivative of \( \frac{1}{3x^2} \) with respect to \( x \)? 
We have to find the derivative of \( \frac{1}{3x^2} \). 
Let \( y = \frac{1}{3x^2} \). 
Differentiating with respect to \( x \), we get: 
\[
\frac{dy}{dx} = \frac{d\left(\frac{1}{3x^2}\right)}{dx} = \frac{1}{3} \frac{d(x^{-2})}{dx}
\]
\[
= \frac{1}{3} \times (-2) \times x^{-2-1}
\]
\[
= \frac{-2}{3x^3}
\]
Thus, the derivative is:
\[
\frac{dy}{dx} = \frac{-2}{3x^3}
\]', 12, -3),
  (14, 'nimcet', 'maths', 'Indefinite Integrals', 'Medium', 'Evaluate: \(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx\)', jsonb_build_array('\(\log \left| {\tan x - \sqrt {16 + {{\tan }^2}x} \;} \right| + C\)', '\(\log \left| {\tan x + \sqrt {16 + {{\tan }^2}x} \;} \right| + C\)', '\(\log \left| {\tan x + \sqrt {4 + {{\tan }^2}x} \;} \right| + C\)', '\(\log \left| {\tan x - \sqrt {4 + {{\tan }^2}x} \;} \right| + C\)'), 1, 'Here we have to find the value of \(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx\)
Let \(\tan x = t\), then \({\sec ^2}x\,dx = dt\)
\(\Rightarrow \smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx = \;\smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }}\)
Now by comparing \(\;\smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }}\) with \(\smallint \frac{{dx}}{{\sqrt {{x^2} + {a^2}} }}\) we get, a = 4
As we know that, \(\smallint \frac{{dx}}{{\sqrt {{x^2} + {a^2}} }} = \log \left| {x + \sqrt {{x^2} + {a^2}} } \right| + C\) where C is a constant
\(\Rightarrow \smallint \frac{{dt}}{{\sqrt {16 + {t^2}} }} = \log \left| {t + \sqrt {{t^2} + 16} } \right| + C\)
Now by substituting tan x = t in the above equation we get,
\(\smallint \frac{{{{\sec }^2}x}}{{\sqrt {16 + {{\tan }^2}x} }}dx = \;\log \left| {\tan x + \sqrt {16 + {{\tan }^2}x} \;} \right| + C\) where C is a constant', 12, -3),
  (15, 'nimcet', 'maths', 'Limit of Functions', 'Medium', 'If \(\rm \displaystyle \lim_{x \rightarrow \infty} \left(\dfrac {x^2+x+1}{x+1}-px-q\right) = -3\) then \(p\) and \(q\) are?', jsonb_build_array('p = 1, q = 3', 'p = 2, q = 3', 'p = 3, q = 1', 'p = 3, q = 2'), 0, '\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{x^2 + x + 1}{x + 1} - px - q \right) = -3
\]
Simplify the expression:
\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{x^2 + x + 1 - px^2 - px - qx - q}{x + 1} \right) = -3
\]
\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{x^2(1 - p) + x(1 - p - q) + (1 - q)}{x + 1} \right) = -3
\]
For the limit to yield a finite value, the coefficient of the highest degree term (\( x^2 \)) must be zero. Therefore:
\[
1 - p = 0 \quad \Rightarrow \quad \mathbf{p = 1}
\]
Substitute \( p = 1 \) into the expression:
\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{x(1 - p - q) + (1 - q)}{x + 1} \right) = -3
\]
\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{x[(1 - p - q) + \dfrac{(1 - q)}{x}]}{x[1 + \dfrac{1}{x}]} \right) = -3
\]
\[
\rm \displaystyle \lim_{x \rightarrow \infty} \left( \dfrac{(1 - p - q) + \dfrac{(1 - q)}{x}}{1 + \dfrac{1}{x}} \right) = -3
\]
As \( x \rightarrow \infty \), \( \dfrac{1}{x} \rightarrow 0 \). Thus:
\[
\rm \dfrac{(1 - p - q) + 0}{1 + 0} = -3
\]
\[
\rm 1 - p - q = -3
\]
Substitute \( p = 1 \):
\[
\rm 1 - 1 - q = -3
\]
\[
\rm -q = -3 \quad \Rightarrow \quad \mathbf{q = 3}
\]', 12, -3),
  (16, 'nimcet', 'maths', 'Function and Relation', 'Easy', 'Let \(R = \{ (a,\,b):a,\,b \in N\) and \({a^2} = b\}\), then what is the relation \(R\) ?', jsonb_build_array('Reflexive', 'Symmetric', 'Transitive', 'None of the above'), 3, 'Here, \(R = \{ (a,\,b):a,\,b \in N\) and \({a^2} = b\}\)
1. Relation \(R\) is not reflexive since \(2 \ne {2^2}\).
2. Since \({2^2} = 4\), so \((2,\,4)\) belongs to \(R\).
But \(4 \ne 2\), so \(R\) is not symmetric.
3. Since \({4^2} = 16\), so \((4,\,16)\) belongs to \(R\).
Also, \({16^2} = 256\), so \((16,\,256)\) belongs to \(R\).
But \({4^2} \ne 256\), so \(R\) is not transitive.
So, \(R\) satisfies none of reflexivity, symmetry and transitivity.
Hence, option D is correct.', 12, -3),
  (17, 'nimcet', 'maths', 'Probability', 'Medium', 'If x is a random variable with Probability Mass Function \(\rm p(x)=\left \{\begin{matrix}\rm kx, & \rm x=1,2,3 \\ 0,& \rm otherwise \end{matrix}\right.\), then k = ?', jsonb_build_array('\(\rm \dfrac{1}{5}\)', '\(\rm \dfrac{1}{4}\)', '\(\rm \dfrac{1}{6}\)', '\(\rm \dfrac{2}{3}\)'), 2, 'Given that \(\rm p(x)=\left \{\begin{matrix}\rm kx, & \rm x=1,2,3 \\ 0,& \rm otherwise \end{matrix}\right.\).
⇒ p(1) = k, p(2) = 2k, p(3) = 3k and p(x) = 0 otherwise.
We also know that Σ p(x) = 1.
⇒ p(1) + p(2) + p(3) = 1
⇒ k + 2k + 3k = 1
⇒ 6k = 1
⇒ \(\rm k=\dfrac{1}{6}\).', 12, -3),
  (18, 'nimcet', 'maths', 'Inverse Trigonometric Function', 'Medium', 'The principal value of \(\rm sin^{-1}(-\frac12)\) is', jsonb_build_array('\(\frac\pi6\)', '\(\frac{7\pi}{6}\)', '\(-\frac\pi6\)', '\(\frac{-\pi}{3}\)'), 2, 'Let, \(\rm sin^{-1}(-\frac12)\) = x
⇒ sin x = \(-\frac12\)
We know, \(\rm sin(\frac\pi6)=\frac12\)
But, here sin x value is negative
∴ x lies in 3rd OR 4th quadrant
But principal value must be in [-π/2, π/2 ]
∴ x = \(-\frac\pi6\)
Hence, option (3) is correct.', 12, -3),
  (19, 'nimcet', 'maths', 'Sets', 'Easy', 'Let, A = {(2n, 3n): n ϵ N} and B = {(3n, 5n): n ϵ N}. What is (A ∩ B) equal to?', jsonb_build_array('{(2n, 3n): n ϵ N}', '{(2n, 5n): n ϵ N}', '{(n, 3n): n ϵ N}', 'ϕ'), 3, 'A = {(2n, 3n): n ϵ N}
= {(2, 3), (4, 6), (6, 9), ………} And
B = {(3n, 5n): n ϵ N}
= {(3, 5), (6, 10), (9, 15), ………}
There is no member common to both the sets
∴ A ∩ B = ϕ
Hence, option (4) is correct.', 12, -3),
  (20, 'nimcet', 'maths', 'Continuity', 'Medium', '\(
f(x) = \left[ |x| - |x - 1| \right]^2
\)
,
What is \(f^{''}(x) \) when x > 1', jsonb_build_array('0', '2x - 1', '4x - 2', '8x - 4'), 0, 'For \( x > 1 \): 
\( |x| = x \) and \( |x - 1| = x - 1 \), so 
\[
|x| - |x - 1| = x - (x - 1) = 1
\]
\[
f(x) = (1)^2 = 1
\]
Since \( f(x) \) is constant for \( x > 1 \), 
\[
f''(x) = 0
\]', 12, -3),
  (21, 'nimcet', 'maths', 'Differential Equations', 'Medium', 'The differential equation representing the family of curves y = a sin (λx + α) is:', jsonb_build_array('\(\rm \frac {d^2y}{dx^2} + \lambda^2y = 0\)', '\(\rm \frac {d^2y}{dx^2} - \lambda^2y = 0\)', '\(\rm \frac {d^2y}{dx^2} + \lambda y = 0\)', 'None of the above'), 0, 'Given:
y = a sin (λx + α) .... (1)
Now differentiating both sides, we get
\(⇒ \rm \frac{dy}{dx} = \frac{a d\sin{(\lambda x + \alpha)}}{d(\lambda x + \alpha)}\times\frac{{d(\lambda x + \alpha)}}{dx} \)
⇒ \(\rm \frac{dy}{dx} = a\lambda\cos\;(\lambda x+\alpha)\)
Again differentiating both sides, we get
\(\Rightarrow \frac{{{{\rm{d}}^2}{\rm{y}}}}{{{\rm{d}}{{\rm{x}}^2}}} = \rm -a\lambda^2\) sin (λx + α)
From equation 1st, 
\(\Rightarrow \frac{{{{\rm{d}}^2}{\rm{y}}}}{{{\rm{d}}{{\rm{x}}^2}}} = \rm -\lambda^2 y\)
∴ \(\rm \frac {d^2y}{dx^2} + \lambda^2y = 0\)', 12, -3),
  (22, 'nimcet', 'maths', 'Area', 'Medium', 'What is the area of the region bounded by the curve \(\rm f(x)=1 - \dfrac{x^2}{4}, x \in [-2, 2]\) and the x-axis?', jsonb_build_array('8/3 square units', '4/3 square units', '2/3 square unit', '1/3 square unit'), 0, 'We know that The area of the region bounded by the curve \(\rm f(x)\) , \(\rm x \in [-a, a]\) and the x-axis is given by
A = \(\rm \displaystyle\int_{-a}^a f(x) \;dx \)
The area of the region bounded by the curve \(\rm f(x)=1 - \dfrac{x^2}{4}, x \in [-2, 2]\) and the x-axis
A = \(\rm \displaystyle\int_{-2}^2 (1 - \dfrac {x^2}{4})dx \)
⇒A = \(\rm \displaystyle \left[x- \dfrac {x^3}{12}\right]^2_{-2}\)
⇒A = \(\rm [2 - (-2)]- \left[\frac {8}{12} -\frac {-8}{12} \right]\)
⇒A = 4 \(-\dfrac 4 3\)
⇒A = \(\dfrac 8 3\)
Hence, the area of the region bounded by the curve \(\rm f(x)=1 - \dfrac{x^2}{4}, x \in [-2, 2]\) and the x-axis is \(\dfrac 8 3\) square units', 12, -3),
  (23, 'nimcet', 'maths', 'Definite Integrals', 'Medium', 'Find the value of the \(\rm \int_{0}^{2\pi}{cosx}\ dx\)', jsonb_build_array('0', '2', '6', '4'), 0, 'Given: \(\rm \int_{0}^{2π}{cosx}\ dx\)
Let, f(x) = cos x
As we can see that, f(2π - x) = cos(2π - x) = cos x = f(x)
As we know that, if f(2a - x) = f(x) then \(\rm \int_{0}^{2a}f(x)dx=2\int_{0}^{a}f(x)dx\) 
​\(\Rightarrow \rm \int_{0}^{2\pi}{cosx}\ dx=2 \int_{0}^{\pi}{cosx}\ dx=2\left [ sin x \right ]_{0}^{\Pi}=0\)​
Hence, the correct option is 1.', 12, -3),
  (24, 'nimcet', 'maths', 'Line', 'Easy', 'Find the equation of the line whose inclination is \( \frac{5\pi}{6} \) and which makes an intercept of 6 units on the negative direction of the y-axis.', jsonb_build_array('\( x + \sqrt{3} y + 6\sqrt{3} = 0 \)', '\( x - \sqrt{3} y + 6\sqrt{3} = 0 \)', '\( x - \sqrt{3} y - 6\sqrt{3} = 0 \)', 'None of these'), 0, 'To find the equation of the line, we''re given: 
Inclination of the line: $\theta = \frac{5\pi}{6}$ 
y-intercept: The line cuts the y-axis at –6 (since it''s in the negative direction and 6 units) 
Step 1: Use the Point-Slope form 
We can write the equation of a line using: 
$$
y = mx + c
$$
Where:
$m = \tan(\theta)$ is the slope
$c =$ y-intercept
Step 2: Calculate the slope $m$ 
$$
m = \tan\left(\frac{5\pi}{6}\right) = \tan\left(150^\circ\right) = -\frac{1}{\sqrt{3}}
$$
Step 3: Use the slope and intercept in the line equation 
Given y-intercept = –6,
$$
y = -\frac{1}{\sqrt{3}}x - 6
$$
\( x + \sqrt{3} y + 6\sqrt{3} = 0 \)', 12, -3),
  (25, 'nimcet', 'maths', 'Application Of Derivative', 'Medium', 'Find the interval in which the function f(x) = (x + 2) e-x is decreasing ?', jsonb_build_array('[- 1, ∞)', '[1, ∞)', '(- ∞, - 1]', 'None of these'), 0, 'Given: f(x) = (x + 2) e-x 
Here we have to find the interval in which f(x) is decreasing.
Let''s first calculate f''(x)
As we know that, \(\frac{d}{{dx}}\left[ {f\left( x \right) ⋅ g\left( x \right)} \right] = f\left( x \right) ⋅ \;\frac{{d\left\{ {g\left( x \right)} \right\}}}{{dx}}\; + \;\;g\left( x \right) ⋅ \;\frac{{d\left\{ {f\left( x \right)} \right\}}}{{dx}}\)
\(⇒ f''\left( x \right) = \left( {x + 2} \right) ⋅ \frac{{d\left( {{e^{ - x}}} \right)}}{{dx}} + {e^{ - x}} ⋅ \frac{{d\left( {x + 2} \right)}}{{dx}}\)
As we know that, \(\frac{{d\left( {{e^{ax}}} \right)}}{{dx}} = a ⋅ {e^{ax}}\)
\(⇒ f''\left( x \right) = \; - \left( {x + 2} \right) ⋅ {e^{ - x}} + {e^{ - x}} ⋅ 1\)
\(⇒ f''\left( x \right) = \; - \left( {x + 1} \right) ⋅ {e^{ - x}}\)
As we know that for a decreasing function say f(x) we have f''(x) ≤ 0.
⇒ - (x + 1) ⋅ e- x ≤ 0
⇒ (x + 1) ⋅ e- x ≥ 0
⇒ x + 1 ≥ 0 ---------(∵ e- x > 0)
⇒ x ≥ - 1
Hence, the interval in which the given function is decreasing is [- 1, ∞)', 12, -3),
  (26, 'nimcet', 'maths', 'Matrices', 'Easy', 'If A = \(\left[ {\begin{array}{*{20}{c}} 1&{3 + x}&2\\ {1 - x}&2&{y + 1}\\ 2&{5 - y}&3 \end{array}} \right]\) is a symmetric matrix, then 3x + y is equal to?', jsonb_build_array('-1', '0', '1', 'none of these'), 0, '\(A = \left[ {\begin{array}{*{20}{c}} 1&{3 + x}&2\\ {1 - x}&2&{y + 1}\\ 2&{5 - y}&3 \end{array}} \right]\)
A = At
 \( A^t=\left[ {\begin{array}{*{20}{c}} 1&{1 - x}&2\\ {3 + x}&2&{5 - y}\\ 2&{y + 1}&3 \end{array}} \right] = \left[ {\begin{array}{*{20}{c}} 1&{3 + x}&2\\ {1 - x}&2&{y + 1}\\ 2&{5 - y}&3 \end{array}} \right] = A\)
On comparing 
3 + x = 1 - x
⇒ x = - 1
And, y + 1 = 5 - y
⇒ y = 2
3x + y = 3(-1) + 2
∴ 3x + y = -1', 12, -3),
  (27, 'nimcet', 'maths', 'Sequence And Series', 'Medium', 'Find the harmonic mean, if arithmetic mean is 27 and geometric mean is 9 ?', jsonb_build_array('9√3', '9', '3', '27'), 2, 'Given AM = 27 and GM = 9
And we know that (GM)2 = (AM) × (HM)
⇒(9)2 = 27 × HM
⇒ HM = \(\frac{81}{27}\)
= 3 
Hence, option (3) is correct.', 12, -3),
  (28, 'nimcet', 'maths', 'Probability', 'Medium', 'A man is known to speak truth 2 out of 3 times. He throws a die and reports that number obtained is a four. Find the probability that the number obtained is actually a four.', jsonb_build_array('1/14', '2/7', '3/7', '5/7'), 1, 'Let \(A\) be the event that the man reports that number four is obtained.
Let \(E_1\) be the event that four is obtained and \(E_2\) be its complementary event.
Then, \(P(E_1)\) = Probability that four occurs = \(1/6\)
\(P(E_2)\) = Probability that four does not occur = \(1 - P(E_1) = 1 - 1/6 = 5/6\)
Also, \(P(A|E_1)\) = Probability that the man reports four and it is actually a four = \(2/3\)
\(P(A|E_2)\) = Probability that the man reports four and it is not a four = \(1/3\)
By using Bayes'' theorem, the probability that the number obtained is actually a four:
\(P\left( {E_1|A} \right) = \frac{{P\left( {E_1} \right)P(A|E_1)}}{{P\left( {E_1} \right)P\left( {A|E_1} \right) + P\left( {E_2} \right)P(A|E_2)}}\)
\( \Rightarrow P\left( {E_1|A} \right) = \frac{{1/6 \times 2/3}}{{1/6 \times 2/3 + 5/6 \times 1/3}} = 2/7\)', 12, -3),
  (29, 'nimcet', 'maths', 'Ellipse', 'Medium', 'If the latus rectum of an ellipse is equal to half of the minor axis, then what is its eccentricity?', jsonb_build_array('2 / √3', '1 / √3', '√3 / 2', '1 / √2'), 2, 'Given, the latus rectum of an ellipse is equal to half of the minor axis.
Suppose, the equation of ellipse is \(\rm \frac{x^2}{a^2}+\frac{y^2}{b^2} = 1\)
length of Latus rectum of ellipse = \(\rm \frac{2b^2}{a}\)
Length of minor axis = 2b.
Given, the latus rectum of an ellipse is equal to half of the minor axis
⇒ \(\rm \frac{2b^2}{a} = b\)
⇒ \(\rm \frac{b}{a} = \frac{1}{2}\)
If the equation of ellipse is \(\rm \frac{x^2}{a^2}+\frac{y^2}{b^2} = 1\) then eccentricity = \(e = \sqrt {1 - (\frac{b}{a})^2}\)
⇒ \(e = \sqrt {1 - (\frac{1}{2})^2}\)
⇒ e = \(\rm\frac {\sqrt {3}}{2}\)
If the latus rectum of an ellipse is equal to half of the minor axis, then what is its eccentricity e = \(\rm\frac {\sqrt {3}}{2}\)', 12, -3),
  (30, 'nimcet', 'maths', 'Function and Relation', 'Easy', 'If * is a binary operation on Z such that a * b = a + b + 1 ∀ a, b ∈ Z then find the identity element of Z with respect to * ?', jsonb_build_array('-1', '1', '0', 'None of these'), 0, 'Given: * is a binary operation on Z such that a * b = a + b + 1 ∀ a, b ∈ Z.
Let e be the identity element of Z with respect to *.
As we know that if e is an identity element of a non-empty set S with respect to a binary operation * then a * e = e * a = a ∀ a ∈ S.
Let a ∈ Z and because e is the identity element of Z with respect to given operation *.
i.e a * e = a = e * a ∀ a ∈ Z.
According to the definition of *, we have
⇒ a * e = a + e + 1 = a ∀ a ∈ Z
⇒ e = - 1
Hence, - 1 is the identity element of Z with respect to given operation *.', 12, -3),
  (31, 'nimcet', 'maths', 'Permutation and Combination', 'Medium', 'If \(\rm ^{22}C_m= {^{22}C_n}\), and m ≠ n, then m + n =', jsonb_build_array('44', '22', '11', '0'), 1, 'Here, \(\rm ^{22}C_m= {^{22}C_n}\)
We know, If \(\rm ^{n}C_x= {^{n}C_y}\) and x ≠ y, then n = x + y, 
∴ m + n = 22 
Hence, option (2) is correct.', 12, -3),
  (32, 'nimcet', 'maths', 'Matrices', 'Easy', 'Transpose of a column matrix is', jsonb_build_array('zero matrix', 'diagonal matrix', 'column matrix', 'row matrix'), 3, 'The transpose of a column matrix is a row matrix.
A column matrix has a single column and multiple rows, like this:
\[
\begin{bmatrix}
a \\
b \\
c
\end{bmatrix}
\]
When you take its transpose, you flip it over its main diagonal (which doesn''t exist in a single column or row explicitly, but the operation swaps rows and columns), resulting in a single row with multiple columns:
\[
\begin{bmatrix}
a & b & c
\end{bmatrix}
\]
So, the correct answer is:
D. row matrix', 12, -3),
  (33, 'nimcet', 'maths', 'Differential Equations', 'Medium', 'Which one of the following differential equation represents the family of straight lines which are at unit distance from the origin?', jsonb_build_array('\({\left( {{\rm{y}} - {\rm{x}}\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2} = 1 - {\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2}\)', '\({\left( {{\rm{y}} + {\rm{x}}\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2} = 1 + {\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2}\)', '\({\left( {{\rm{y}} - {\rm{x}}\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2} = 1 + {\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2}\)', '\({\left( {{\rm{y}} + {\rm{x}}\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2} = 1 - {\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}} \right)^2}\)'), 2, 'Let the straight lines be of the form: y = mx + c …. (i)
⇒ y – mx – c = 0
Given: straight lines which are at unit distance from the origin
\(1 = {\rm{\;}}\left| {\frac{{0 - 0 - {\rm{\;c}}}}{{\sqrt {1 + {{\rm{m}}^2}{\rm{\;}}} }}} \right|\)
\( \Rightarrow {\rm{c}} = \sqrt {1 + {{\rm{m}}^2}} \)
Replacing c in eqn (i)
\({\rm{y}} = {\rm{mx}} + {\rm{\;}}\sqrt {1 + {{\rm{m}}^2}} \) …. (ii)
On differentiating with respect to x, we get
\(\frac{{{\rm{dy}}}}{{{\rm{dx}}}} = {\rm{m}}\)
Replacing m in eqn (ii)
\({\rm{y}} = \frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{x}} + \sqrt {1 + {{\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{\;}}} \right)}^2}} \)
\( \Rightarrow {\rm{\;y}} - \frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{x}} = \sqrt {1 + {{\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{\;}}} \right)}^2}} \)
\( \Rightarrow {\left( {{\rm{y}} - \frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{x}}} \right)^2}{\rm{\;}} = 1 + {\left( {\frac{{{\rm{dy}}}}{{{\rm{dx}}}}{\rm{\;}}} \right)^2}\)', 12, -3),
  (34, 'nimcet', 'maths', 'Binomial Theorem', 'Medium', 'If the third term in the binomial expansion of \({(1 + x)^m}\) is \((-1/8){x^2}\), then the rational value of \(m\) is', jsonb_build_array('2', '\(\frac 12\)', '3', 'None of these'), 1, 'Given: the third term in the binomial expansion of \({(1 + x)^m}\) is \((-1/8){x^2}\)
\(\rm (1+x)^m= 1+mx+\frac{m(m-1)}{2!}x^2+\frac{m(m-1)(m-2)}{3!}x^3 +....\)
So, the third term in the binomial expansion of \({(1 + x)^m}\) is \(\rm \frac{m(m-1)}{2!}x^2\)
\(\rm \frac{m(m-1)}{2!}x^2\) = \((-1/8){x^2}\)
\( \Rightarrow \rm \frac{m(m-1)}{2}= \frac {-1}{8}\)
\( \Rightarrow 4{m^2} - 4m + 1 = 0\)
\( \Rightarrow {(2m - 1)^2} = 0\)
\( \Rightarrow 2m - 1 = 0\)
∴ \(m = \frac 12\)', 12, -3),
  (35, 'nimcet', 'maths', 'Sequence And Series', 'Medium', 'If the sequence \(\{ {s_n}\} \) is a geometric progression and \({s_2}{s_{11}} = {s_p}{s_8}\), then what is the value of \(p\) ?', jsonb_build_array('1', '3', '5', 'can not be determined'), 2, 'Given: \({s_2}{s_{11}} = {s_p}{s_8}
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
∴ \(p = 5\)', 12, -3),
  (36, 'nimcet', 'maths', 'Line', 'Easy', 'What is the inclination of the line x - y + √3 = 0 ?', jsonb_build_array('30°', '60°', '45°', '90°'), 2, 'Given: x - y + √3 = 0
We will first express the equation of the line in the standard form.
Thus the equation of the line is y = x + √3 
Therefore, the slope of the given line is m = tan θ = 1
∴ θ = tan-1 1 = 45° 
Thus, the angle of inclination is 45°.', 12, -3),
  (37, 'nimcet', 'maths', 'Line', 'Easy', 'What is the equation of the straight line which joins the intersection of the line x - y + 4 = 0 and y - 2x - 5 = 0 and the point (3, 2)?', jsonb_build_array('x + y - 11 = 0', 'x - 2y - 11 = 0', 'x + 3y - 11 = 0', 'x + 4y - 11 = 0'), 3, 'Given lines x - y + 4 = 0 ...(i)
y - 2x - 5 = 0 ...(ii)
Adding the 2 equation (i) and (ii)
-x - 1 = 0
x = -1
Putting it in equation (i)
-1 - y + 4 = 0
y = 3
Intersection of the lines (-1, 3)
Now the equation of the line to be find out is 
\(\rm {y-3\over x -(-1)} = {2 - 3\over 3 - (-1)}\)
4(y - 3) = -1(x + 1)
4y + x - 11 = 0', 12, -3),
  (38, 'nimcet', 'maths', 'Probability', 'Medium', 'Consider the following statements: 
1. If \( A \) and \( B \) are mutually exclusive events, then it is possible that \( P(A) = P(B) = 0.6 \). 
2. If \( A \) and \( B \) are any two events such that \( P(A|B) = 1 \), then \( P(\bar{B}|\bar{A}) = 1 \). 
Which of the above statement(s) is/are correct?', jsonb_build_array('1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'), 1, 'Statement 1:
If A and B are mutually exclusive events, then P (A ∩ B) = 0.
We know that P (A ∪ B) = P(A) + P(B) – P (A ∩ B) = 0.6 + 0.6 = 1.2 > 1
This contradicts ∵ probability of any event say A: 0 ≤ P (A) ≤ 1.
Hence statement 1 is wrong.
Statement 2:
Given: P(A|B) = 1
As we know, P (A | B) = P(A ∩ B) / P(B) = 1
⇒ B ⊆ A
⇒ P (B̅ | A̅) = P(A̅ ∩ B̅) / P(A̅) = P(A ∪ B) / P(A̅) = P(A̅) / P(A̅) = 1
Hence, statement 2 is true.', 12, -3),
  (39, 'nimcet', 'maths', 'Differentiability', 'Easy', 'If x = \(\rm {{1\ -\ t}\over {1\ +\ t}}\) and y = \(\rm {2t\over {1\ +\ t}}\), then find the value of \(\rm {d^2y\over dx^2}\).', jsonb_build_array('\(\rm\frac{1}{y}\)', '\(\rm\frac{-1}{y}\)', '\(\rm {{-1}\over {y^3}}\)', '0'), 3, 'We have x = \(\rm {{1\ -\ t}\over {1\ +\ t}}\) and y = \(\rm {2t\over {1\ +\ t}}\).
We observe that x + y = \(\rm \left({{1\ -\ t}\over {1\ +\ t}}\right)+\left({{2t}\over {1\ +\ t}}\right)={1\ +\ t\over1\ + \ t}\) = 1.
Differentiating w.r.t. x, we get:
1 + \(\rm {dy\over dx}\) = 0
⇒ \(\rm {dy\over dx}\) = -1
Differentiating again w.r.t. x, we get:
\(\rm \frac{d^2y}{dx^2}=0\).', 12, -3),
  (40, 'nimcet', 'maths', 'Determinants', 'Medium', 'Let A be a non-singular matrix of the order 2 × 2 then |A-1| =', jsonb_build_array('|A|', '\(\rm \frac {1}{|A|}\)', '0', 'None of these'), 1, 'Given that \( A \) is a non-singular matrix of order \( 2 \times 2 \), \[\]
we need to determine \( |A^{-1}| \), where \( |A^{-1}| \) represents the determinant of the inverse of \( A \). \[\]
 Step 1: Determinant Property of Inverse Matrix \[\]
For any square, non-singular matrix \( A \), the determinant of its inverse is given by:
\[
|A^{-1}| = \frac{1}{|A|}
\]
where \( |A| \) is the determinant of \( A \). \[\]
 Step 2: Applying to a \( 2 \times 2 \) Matrix \[\]
Since \( A \) is a \( 2 \times 2 \) matrix, this property holds, and we directly get:
\[
|A^{-1}| = \frac{1}{|A|}
\]
 Conclusion \[\]
Thus, the determinant of the inverse of \( A \) is:
\(
\frac{1}{|A|}
\)', 12, -3),
  (41, 'nimcet', 'maths', 'Application Of Derivative', 'Medium', 'The normal to a given curve is parallel to x-axis if', jsonb_build_array('\(\frac{{dy}}{{dx}} = 0\)', '\(\frac{{dy}}{{dx}} = 1\)', '\(\frac{{dx}}{{dy}} = 0\)', '\(\frac{{dx}}{{dy}} = 1\)'), 2, 'Let us consider a function f(x) , such that slope of tangent be mt and slope of normal be mn
Now , we know that, normal is perpendicular to tangent, such that mt × mn = -1
mn × dy/dx = -1
⇒ mn = - dx/dy
Now, as per the question, the normal is parallel to the x-axis, so the slope of normal is equal to the slope of the x-axis (i.e. zero)
∴ mn = 0
⇒ - dx/dy = 0
⇒ dx/dy = 0
∴ The normal to a given curve is parallel to x-axis if dx/dy = 0', 12, -3),
  (42, 'nimcet', 'maths', 'Probability', 'Medium', 'A coin is tossed 3 times. What is the probability that they will fall two heads and one tail?', jsonb_build_array('1 / 3', '1 / 2', '1 / 4', '3 / 8'), 3, 'A coin is tossed 3 times
Sample Space are,
S = {(H,H,H) , (H,H,T) , (H,T,H) , (H,T,T) , (T,H,H) , (T,H,T) , (T,T,H) , (T,T,T)}
∴ Total no of Outcomes = 8
To find: the probability that they will fall two heads and one tail
Taking two heads and one tail,
Thus, Favourable outcomes are = {(H,H,T) , (H,T,H), (T,H,H)} = 3
Hence the probability that they will fall two heads and one tail = 3/8', 12, -3),
  (43, 'nimcet', 'maths', 'Circle', 'Medium', 'Find the radius of the circle \(5{x^2} + 5{y^2} - 20x - 6y + 15 = 0\).', jsonb_build_array('\(\frac{\sqrt{34}}{5}\)', '\(\frac{\sqrt{37}}{5}\)', '\(\frac{6}{5}\)', '\(\sqrt{\frac{6}{5}}\)'), 0, 'Given equation of the circle is \(5{x^2} + 5{y^2} - 20x - 6y + 15 = 0\)
\( \Rightarrow {x^2} + {y^2} - 4x - \frac{6}{5}y + 3 = 0\;\;...(i)\)
On comparing eq. (i) with the standard equation of a circle \({x^2} + {y^2} + 2gx + 2fy + c = 0\),
we get \(g = - 2\), \(f = \frac{{ - 3}}{5}\) and \(c = 3\).
As we know, radius of the circle \( = \sqrt {{g^2} + {f^2} - c} \)
\( \Rightarrow r = \sqrt {{{( - 2)}^2} + {{\left( {\frac{{ - 3}}{5}} \right)}^2} - 3} = \sqrt {4 + \frac{9}{{25}} - 3} \)
\( \Rightarrow r = \frac{{\sqrt {34} }}{5}\) units.
Hence, option A is correct.', 12, -3),
  (44, 'nimcet', 'maths', 'Matrices', 'Easy', 'If \(A\) is a skew symmetric matrix, then \({A^2}\) is a', jsonb_build_array('null matrix', 'unitary matrix', 'skew symmetric', 'symmetric'), 3, 'For a skew symmetric matrix \(A\), \({A^T} = - A\).
Then \({({A^2})^T} = {({A^T})^2} = {( - A)^2} = {A^2}\).
Hence, \({A^2}\) is a symmetric matrix.', 12, -3),
  (45, 'nimcet', 'maths', 'Sequence And Series', 'Medium', 'Find the sum of the series \( 1 \cdot 2 + 2 \cdot 3 + 3 \cdot 4 + 4 \cdot 5 + \dots + 8 \cdot 9 \) ?', jsonb_build_array('240', '260', '225', '264'), 0, 'Here, we have to find the sum of the series: 
\[
1 \cdot 2 + 2 \cdot 3 + 3 \cdot 4 + 4 \cdot 5 + \dots + 8 \cdot 9
\] 
As we know, the \( n \)th term of the given series is given by: 
\[
T_n = n (n + 1)
\] 
The sum of the series is: 
\[
S_n = \sum T_n = \sum (n^2 + n) = \sum n^2 + \sum n
\] 
From standard summation formulas: 
\[
\sum n^2 = \frac{n(n+1)(2n+1)}{6}, \quad \sum n = \frac{n(n+1)}{2}
\] 
Thus, 
\[
S_n = \frac{n(n+1)(n+2)}{3}
\] 
For \( n = 8 \): 
\[
S_8 = \frac{8 \times 9 \times 10}{3} = 240
\]', 12, -3),
  (46, 'nimcet', 'maths', 'Differential Equations', 'Medium', 'The solution of the differential equation \(\rm dy\over dx \) = 2x - 1 is', jsonb_build_array('\(\rm y = \frac 1 {\ln 2} 2^x +c\)', '\(\rm y^2 = \frac 1 {\ln 2} 2^x +c\)', '\(\rm 2y = \frac 1 {\ln 2} 2^x +c\)', '\(\rm 2y^2 = \frac 1 {\ln 2} 2^x +c\)'), 2, 'Given, the differential equation \(\rm \dfrac {dy}{dx}\) = 2x - 1 
⇒ \(\rm \dfrac {dy}{dx}\) = \(\rm \dfrac {2^x}{2^{}}\)
⇒ \(\rm {2^{}} \; dy = 2^x \; dx\)
Now, variables are separated.
Integrating both sides, we get
⇒ \(\rm2 \int \; dy = \int 2^x \; dx\)
⇒ \(\rm 2y = \frac 1 {\ln 2} 2^x +c\)', 12, -3),
  (47, 'nimcet', 'maths', 'Function and Relation', 'Easy', 'If * is a binary operation on A = {1, 2, 3, 4, 5} given by the table shown below:
\begin{array}{|c|c|c|c|c|c|}
\hline
* & 1 & 2 & 3 & 4 & 5 \\ \hline
1 & 1 & 1 & 1 & 1 & 1 \\ \hline
2 & 1 & 2 & 1 & 2 & 1 \\ \hline
3 & 1 & 1 & 3 & 1 & 1 \\ \hline
4 & 1 & 2 & 1 & 4 & 1 \\ \hline
5 & 1 & 1 & 1 & 1 & 5 \\ \hline
\end{array}
\]
Find the value of (2 * 3) * (4 * 5) ?', jsonb_build_array('1', '2', '3', '4'), 0, 'To solve \((2 * 3) * (4 * 5)\) using the given binary operation table, follow these steps:
Find \(2 * 3\)
From the table, locate the row for \(2\) and the column for \(3\): 
\[
2 * 3 = 1
\]
 Find \(4 * 5\)
From the table, locate the row for \(4\) and the column for \(5\): 
\[
4 * 5 = 1
\]
 Find \((2 * 3) * (4 * 5)\)
Now, substitute the results from Steps 1 and 2 into the expression: 
\[
(2 * 3) * (4 * 5) = 1 * 1
\]
From the table, locate the row for \(1\) and the column for \(1\): 
\[
1 * 1 = 1
\]
Final Answer:
\[
(2 * 3) * (4 * 5) = 1
\]', 12, -3),
  (48, 'nimcet', 'maths', 'Matrices', 'Easy', 'If x + 2y = \(\begin{bmatrix} 2 & -3\\ 1 & 5 \end{bmatrix}\)and 2x + 5y = \(\begin{bmatrix} 7 & 5\\ 2 & 3 \end{bmatrix}\), then y is equal to ?', jsonb_build_array('\( \begin{bmatrix} 3 & 11\\ 0 & 7 \end{bmatrix}\)', '\( \begin{bmatrix} 3 & 5\\ 0 & -7 \end{bmatrix}\)', '\( \begin{bmatrix} 3 & 11\\ 0 & -7 \end{bmatrix}\)', '\( \begin{bmatrix} 3 & 5\\ 0 &7 \end{bmatrix}\)'), 2, 'x + 2y = \(\begin{bmatrix} 2 & -3\\ 1 & 5 \end{bmatrix}\) .... (1)
2x + 5y = \(\begin{bmatrix} 7 & 5\\ 2 & 3 \end{bmatrix}\) .... (2)
Multiplying by 2 in the equation (1), we get
⇒ 2x + 4y = \(\begin{bmatrix} 4 & -6\\ 2 & 10 \end{bmatrix}\) .... (3)
Subtracting equation (3) from equation (2), we get
⇒ (2x + 5y) - (2x + 4y) = \(\begin{bmatrix} 7 & 5\\ 2 & 3 \end{bmatrix}-\begin{bmatrix} 4 & -6\\ 2 & 10 \end{bmatrix}\)
∴ y = \( \begin{bmatrix} 3 & 11\\ 0 & -7 \end{bmatrix}\)', 12, -3),
  (49, 'nimcet', 'maths', 'Probability', 'Medium', 'A die is tossed once. There are 3 events of getting a prime number, multiple of 2, and 1. These events are together called?', jsonb_build_array('Mutually exhaustive', 'Exhaustive', 'Compound exhaustive', 'Both a and b'), 1, 'Event of getting prime numbers: 2, 3, 5 
Event of getting multiple of 2: 2, 4, 6 
Event getting 1: 1. 
So, there is always a certain chance of occurrence of at least one of them when they are all considered together. Hence exhaustive events.', 12, -3),
  (50, 'nimcet', 'maths', 'Differentiability', 'Easy', 'If y = \(\rm \cos ^ {-1} \left(\frac {1 - x}{1 + x}\right)\), then find \(\rm\frac{dy}{dx}\).', jsonb_build_array('\(\rm2\over {1 + x}\)', '\(\rm 1\over {\sqrt x (x + 1)}\)', '\(\rm 1\over {x \sqrt{x + 1}}\)', '\(\rm1\over {1 + x}\)'), 1, 'We have y = \(\rm \cos ^ {-1} \left(\frac {1 - x}{1 + x}\right)\).
Let x = tan2 z.
∴ y = \(\rm \cos ^ {-1} \left(\frac {1 - \tan^2z}{1 + \tan^2z}\right)\) = cos-1 (cos 2z) = 2z.
Now, differentiating w.r.t. z, we get:
\(\rm\frac{dx}{dz}= \frac{d}{dz}\left(\tan^2z\right)=2\tan z\sec^2z\)
\(\rm\frac{dy}{dz}= \frac{d}{dz}(2z)=2\)
Using the chain rule of derivatives, we get:
\(\rm\frac{dy}{dx}= \frac{dy}{dz}\times\frac{dz}{dx}=\frac{2}{2\tan z\sec^2z}=\frac{1}{\tan z(1+\tan^2z)}=\frac{1}{\sqrt x(1+x)}\).', 12, -3),
  (51, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'In a certain code, COMPATIBLE is written as BQNPDDKAHS. How is STABILISED written in that code?', jsonb_build_array('TUBCJCDRHK', 'JCBUTEDTHM', 'JCBUTCDRHK', 'JCBUTEFTJM', 'None of these'), 2, 'The letters in the first half and second half of the word are written in the reverse order and in the group of letters so obtained, each letter in the first half is moved one step forward while that in the second half is moved one step backward, to get the code.
Thus, we have :
STABILISED => STABI/LISED => IBATS/DESIL => JCBUT/CDRHK', 6, -1.5),
  (52, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Itanagar : Arunachal Pradesh :: Amravati : ?', jsonb_build_array('Nagaland', 'Meghalaya', 'West Bengal', 'Andhra Pradesh'), 3, 'From analyzing the left side, we can conclude that Itanagar is the capital of Arunachal Pradesh.', 6, -1.5),
  (53, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Explain : Elaborate :: Eager : ?', jsonb_build_array('Necessary', 'Fervent', 'Hasty', 'Terror'), 1, 'From analyzing the left side, we can conclude that Explain is similar to Elaborate.', 6, -1.5),
  (54, 'nimcet', 'reasoning', 'Alphanumeric series', 'Easy', 'Find the missing term in the given series:
l_n_mllm_n_l', jsonb_build_array('mnmn', 'mnnm', 'mnmm', 'nmmn'), 1, 'lmn/nml/lmn/nml ⇒ mnnm
The sequence is repeat of alternative two block lmn and nml.', 6, -1.5),
  (55, 'nimcet', 'reasoning', 'Calendars', 'Easy', 'If 25th of August in a year is Thursday, the number of Mondays in that month is', jsonb_build_array('5', '7', '9', '11'), 0, 'Given that 25th August = Thursday
Hence 29th August = Monday
So 22nd,15th and 8th and 1st of August also will be Mondays
Number of Mondays in August = 5', 6, -1.5),
  (56, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Dispur : Assam :: Shillong : ?', jsonb_build_array('Nagaland', 'Meghalaya', 'West Bengal', 'Nepal'), 1, 'From analyzing the left side, we can conclude that Dispur is the capital of Assam.', 6, -1.5),
  (57, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'If white is called yellow, yellow is called blue, blue is called red, red is called black, black is called violet and violet is called green, then what would be the colour of light emitting from bulb?', jsonb_build_array('Red', 'Blue', 'Black', 'Yellow'), 1, 'Here, the colour of light emitting from bulb is yellow and it is given that yellow is called blue.', 6, -1.5),
  (58, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Ink : Pen :: Blood : ?', jsonb_build_array('Accident', 'Doctor', 'Vein', 'Donation'), 2, 'Ink flows in Pen in same way as Blood flows in Vein.', 6, -1.5),
  (59, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Find the number that do not forms the group.', jsonb_build_array('3229', '4127', '5218', '7018'), 1, 'Except 4127, Sum of all digits of the number gives 16.', 6, -1.5),
  (60, 'nimcet', 'reasoning', 'Blood Relations', 'Easy', 'Rahul is brother of Nilesh. Diva is daughter of Nilesh. Parul who is daughter of Rahul is married to Kapil. Ankita is sister of Nilesh. What is the relation between Ankita and Parul?', jsonb_build_array('Sister', 'Aunt', 'Mother', 'Mother-in-law'), 1, 'Here, it is given that Rahul and Nilesh are brothers and Parul is Daughter of Rahul. Ankita is sister of Nilesh i.e. Ankita is sister of Rahul. So, it is clear that Ankita is aunt of Parul.', 6, -1.5),
  (61, 'nimcet', 'reasoning', 'Blood Relations', 'Easy', 'Read the given information carefully. P & Q are sisters. P is the daughter of S. R is the only son of T. U is the sister of T. S is the wife of T. 
 Then how is U related to Q?', jsonb_build_array('Mother', 'Sister', 'Uncle', 'Aunt'), 3, 'The family tree is drawn using the symbols given below:
P & Q are sisters. P is the daughter of S.
R is the only son of T. U is the sister of T.
S is the wife of T. Then the family tree can be drawn as below connecting all the information:
Now it is clear that U is the sister of Q’s father.
Hence U is theauntof Q.', 6, -1.5),
  (62, 'nimcet', 'reasoning', 'Cause and Effect', 'Easy', 'Direction : Two statements I and II are given. These statement may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statements. Read both the statements and decide which of the following answer choice correctly depicts the relationship between these two statements. Mark answer : 
I. There is increase in water level of all the water tanks supplying drinking water to the city during the last fortnight.
II. Most of the trains were cancelled last week due to water-logging on the tracks.', jsonb_build_array('Statement I is the cause and statement II is its effect', 'Statement II is the cause and statement I is its effect', 'Both the statements I and II are independent causes', 'Both the statements I and II are effects of independent causes', 'Both the statements I and II are effects of some common cause'), 4, 'The problems discussed in both the statements are clearly the result of heavy downpour in the area.', 6, -1.5),
  (63, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Banana is related to Fruit in same way as Chrysanthemum is related to :', jsonb_build_array('Fruit', 'Stem', 'Flower', 'Root'), 2, 'Banana is Fruit in same way, Chrysanthemum is Flower.', 6, -1.5),
  (64, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Ask : Query :: Hurt : ?', jsonb_build_array('Fervent', 'Distress', 'Cooperation', 'Terror'), 1, 'From analyzing the left side, we can conclude that Ask is similar to Query.', 6, -1.5),
  (65, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'If white is called yellow,
 yellow is called blue,
 blue is called red,
 red is called black,
 black is called violet,
 violet is called green,
 green is called magenta,
 and magenta is called white 
 then what would be the colour if we mix yellow and magenta together?', jsonb_build_array('Red', 'Green', 'Black', 'Yellow'), 2, 'Here, the colour when we mix yellow and magenta will be red and it is given that red is called black.', 6, -1.5),
  (66, 'nimcet', 'reasoning', 'Blood Relations', 'Easy', 'Looking at a portrait of a man, Harsh said, "His mother is the wife of my father''s son. Brothers and sisters I have none." At whose portrait was Harsh looking?', jsonb_build_array('His son', 'His cousin', 'His uncle', 'His nephew'), 0, 'Since Harsh has no brother and sister, so he is his father''s only son.So, wife of Harsh''s father''s son---Harsh''s wife. Thus, Harsh''s wife is the man''s mother or the man is Harsh''s son.', 6, -1.5),
  (67, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'In a certain code, MOTHER is written as ONHURF. How will ANSWER be written in that code?', jsonb_build_array('NBXSSE', 'NBWRRF', 'MAVSPE', 'NBWTRF', 'None of these'), 3, 'Divide the word into three groups of two letters each and write the letters of each group in the reverse order. In the group of letters so obtained, the second, fourth and sixth letters are each moved one step forward to get the code. Thus, we have : AN SW ER => NA WS RE => NBWTRF.', 6, -1.5),
  (68, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'In a certain language PRACTICE is coded as PICCTRAE, how is FLAMES coded in that code ?', jsonb_build_array('FEMALS', 'FALMES', 'FMELAS', 'FALEMS'), 2, 'PRACTICE = PICCTRAE.
First and last letters are same but second and third letters and third last and second last letters have been interchanged.
So, 
FLAMES = FMELAS.', 6, -1.5),
  (69, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Secretly is to openly as silently is to', jsonb_build_array('scarcely', 'impolitely', 'noisily', 'quietly'), 2, 'Secretly is the opposite of openly, and silently is the opposite of noisily. Choices a and b are clearly not the opposites of silently. (Choice d) means the same thing as silently.', 6, -1.5),
  (70, 'nimcet', 'reasoning', 'Cause and Effect', 'Easy', 'Direction : Two statements I and II are given. These statement may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statements. Read both the statements and decide which of the following answer choice correctly depicts the relationship between these two statements. Mark answer : 
I. Large number of people living in the low-lying areas has been evacuated during the last few days to safer places.
II. The Government has rushed in relief supplies to the people living in the affected areas.', jsonb_build_array('Statement I is the cause and statement II is its effect', 'Statement II is the cause and statement I is its effect', 'Both the statements I and II are independent causes', 'Both the statements I and II are effects of independent causes', 'Both the statements I and II are effects of some common cause'), 4, 'Evacuating low-lying areas and rushing in relief to the affected areas clearly indicates that floods have occurred in the area.', 6, -1.5),
  (71, 'nimcet', 'reasoning', 'Blood Relations', 'Easy', 'Pointing to a photograph, Jack said, “This man is the husband of the daughter-in-law of my great grandfather’s only grandson who has only one child.”
How Jack is related to that grandson’s daughter-in-law?', jsonb_build_array('Son', 'Father', 'Grandfather', 'None of the above'), 3, 'Let us represent the given relations in the form of a family tree
\[
\begin{array}{c}
\text{Great-Grandfather} \\
\downarrow \\
\text{Grandfather} \\
\downarrow \\
\text{Father (only grandson)} \\
\downarrow \\
\text{Jack (only child)} \\
\downarrow \\
\text{Jack''s Wife (Daughter-in-law of Father)} \\
\downarrow \\
\text{Jack (himself)} 
\end{array}
\]
The person in the photograph is Jack himself. \[\]
So, Jack is the husband of that grandson''s doughter-in-law.', 6, -1.5),
  (72, 'nimcet', 'reasoning', 'Odd One Out', 'Easy', 'Find the odd number / letters or word from the given alternative', jsonb_build_array('Cool', 'Warm', 'Sultry', 'Hot', 'Humid'), 0, 'All except Cool denote uncomfortable weather conditions.', 6, -1.5),
  (73, 'nimcet', 'reasoning', 'Calendars', 'Easy', 'On what dates of April, 2001 did Wednesday fall?', jsonb_build_array('1st, 8th, 15th, 22nd, 29th', '2nd, 9th, 16th, 23rd, 30th', '3rd, 10th, 17th, 24th', '4th, 11th, 18th, 25th'), 3, 'We shall find the day on 1st April, 2001.
1st April, 2001 = (2000 years + Period from 1.1.2001 to 1.4.2001)
Odd days in 1600 years = 0
Odd days in 400 years = 0
Jan. Feb. March April
(31 + 28 + 31 + 1) = 91 days ≡ 0 odd days.
Total number of odd days = (0 + 0 + 0) = 0
On 1st April, 2001 it was Sunday.
In April, 2001 Wednesday falls on 4th, 11th, 18th and 25th.', 6, -1.5),
  (74, 'nimcet', 'reasoning', 'Cause and Effect', 'Easy', 'Direction : Two statements I and II are given. These statement may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statements. Read both the statements and decide which of the following answer choice correctly depicts the relationship between these two statements. Mark answer : 
I. Majority of the citizens in the locality belongs to higher income group.
II. The sales in the local super market are comparatively much higher than in other localities.', jsonb_build_array('Statement I is the cause and statement II is its effect', 'Statement II is the cause and statement I is its effect', 'Both the statements I and II are independent causes', 'Both the statements I and II are effects of independent causes', 'Both the statements I and II are effects of some common cause'), 0, 'The comparatively higher sales in a particular locality are indicative of the high paying capacity of the residents of that locality.', 6, -1.5),
  (75, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'In a certain code FIRE is coded as DGPC. What will be the last letter of the coded word for SHOT.', jsonb_build_array('Q', 'R', 'S', 'P'), 1, 'D is used for F.
G is used for I.
P is used for R.
and
C is used for E.
Thus, it is clear that each letter of the word FIRE stands for each corresponding letter of the coded word DGPC two places ahead. By applying the same principle, the letters QFMR will stand for SHOT. Hence, the last letter of the coded word is R.', 6, -1.5),
  (76, 'nimcet', 'reasoning', 'Calendars', 'Easy', 'Directions: Complete the sentences given below sing the correct alternative.
If today is Wednesday, day after tomorrow will be', jsonb_build_array('Thursday', 'Monday', 'Tuesday', 'Saturday', 'None of the above'), 4, 'The correct answer is:5) None of the above
Key Points
Therefore, the correct answer is Option 5, ''None of the above''.', 6, -1.5),
  (77, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'If in a certain code language, FLOWER is coded as UOLDVI, then how is TERMINAL coded in that language?', jsonb_build_array('FLKPMROZ', 'GVINRMZO', 'RVNIGLKA', 'MNIVGYEO'), 1, 'Each letter in the word is replaced by the letter which occupies the same position from the other end of the alphabet, to obtain the code. Thus, A is replaced by Z, B by Y, C by X, D by W and so on.', 6, -1.5),
  (78, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Major is related to Leiutenant in the same way as ‘Squadron Leader is Related to _____?', jsonb_build_array('Pilot officer', 'Flying Attendant', 'Flying officer', 'More than one of the above'), 2, 'The relationship between "Major" and "Lieutenant" can be understood as a ranking within a military hierarchy where "Major" is a rank above "Lieutenant."
Similarly, "Squadron Leader" is related to "Flying Officer" in a similar hierarchical manner as "Major" is related to "Lieutenant."
Hence, the correct answer is "Flying officer".', 6, -1.5),
  (79, 'nimcet', 'reasoning', 'Calendars', 'Easy', 'If 1st October is Sunday, then 1st November will be', jsonb_build_array('Monday', 'Tuesday', 'Wednesday', 'Thursday'), 2, 'Given that 1st October is Sunday
Number of days in October = 31
31 days = 3 odd days
(As we can reduce multiples of 7 from odd days which will not change anything)
Hence 1st November = (Sunday + 3 odd days) = Wednesday', 6, -1.5),
  (80, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', '343 : 7 :: 6859 : ?', jsonb_build_array('15', '18', '19', '22'), 2, 'Reasoning Analogy Solution Solution Breakdown The problem requires us to identify the relationship between the first pair of numbers and then apply that same relationship to the second pair to find the missing number.
The analogy is: 343 : 7 :: 6859 : ? Step 1: Analyze the relationship in the first pair (343 : 7) We need to find how 343 and 7 are related. Let''s test for powers and roots. We can calculate the cube of 7: $7^3 = 7 \times 7 \times 7 = 49 \times 7 = 343$. The relationship is that the first number is the cube of the second number. Conversely, the second number is the cube root of the first number ($∛{343} = 7$). Step 2: Apply the relationship to the second pair (6859 : ?) Using the same logic, we need to find the cube root of 6859. Let the missing number be ''x''. The equation is $x^3 = 6859$. We can observe that the number 6859 ends in 9. The only digit (from 0-9) whose cube also ends in 9 is 9 itself ($9^3 = 729$). This means our answer must end in the digit 9. Looking at the options, the only number that ends in 9 is 19. To confirm, we can calculate $19^3$: $19 \times 19 \times 19 = 361 \times 19 = 6859$. Conclusion The missing number that completes the analogy is 19.
This corresponds to option C.', 6, -1.5),
  (81, 'nimcet', 'reasoning', 'Coding Decoding', 'Easy', 'In a certain code, PRODUCTIONS is written as QQPCVEUHPMT. How is ORIENTATION written in that code?', jsonb_build_array('PQJDOVBSJNO', 'PQJDOUBUJPO', 'PSJFOVBSJNO', 'NSHFMVBSJNO', 'None of these'), 0, 'The first, third, fifth, seventh, ninth, and eleventh letters in the word are each moved one step forward; the second, fourth, eighth and tenth letters are each moved one step backward, while the middle (i.e. sixth) letter is moved two steps forward to obtain the corresponding letters of the code.', 6, -1.5),
  (82, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Amusing : Droll :: Abolish : ?', jsonb_build_array('Execute', 'Accept', 'Abort', 'Brake'), 2, '', 6, -1.5),
  (83, 'nimcet', 'reasoning', 'Calendars', 'Easy', 'Directions: Question below is followed by two statements, I and II. Read the statements given and mark the answer.
Is it Friday today?
I. February 15 of this year was a Wednesday.
II. Today is March 12.', jsonb_build_array('Question can be answered by statement I alone.', 'Question can be answered by statement II alone.', 'Question can be answered by using both statements together, but cannot be answered using either statement alone.', 'Question cannot be answered even by using both statements together.'), 3, 'Statement I:February 15 of this year was a Wednesday: We cannot get what is today’s date.
Statement II:Today is March 12: We can’t tell which day today is, it can be any day.
Taking both the statements together: We cannot tell whether it is Friday or not because we don’t know if the year is leap year or not.', 6, -1.5),
  (84, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', '343 : 7 :: 512 : ?', jsonb_build_array('2', '8', '6', '9'), 1, '343 : 7 :: 512 : ?
Step 1: Analyze the relationship between the first pair. 343 is the cube of 7, since 73 = 343.
Step 2: Apply the same relationship to the second pair. Find the cube root of 512. Since 83 = 512, the unknown number is 8.
Answer: The correct answer is (B) 8.', 6, -1.5),
  (85, 'nimcet', 'reasoning', 'Cause and Effect', 'Easy', 'Direction : Two statements I and II are given. These statement may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statements. Read both the statements and decide which of the following answer choice correctly depicts the relationship between these two statements. Mark answer :
I. It is the aim of the city''s civic authority to get the air pollution reduced by 20% in the next two month.
II. The number of asthma cases in the city is constantly increasing.', jsonb_build_array('If statement I is the cause and statement II is its effect.', 'If statement II is the cause and statement I is its effect.', 'If both the statements I and II are independent causes.', 'If both the statements I and II are effects of independent causes.', 'If both the statement I and II are effects of some common cause.'), 1, 'The increase in number of asthma cases must have alerted the authorities to take action to control air pollution that triggers the diseases.', 6, -1.5),
  (86, 'nimcet', 'reasoning', 'Cause and Effect', 'Easy', 'Direction : Two statements I and II are given. These statement may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statements. Read both the statements and decide which of the following answer choice correctly depicts the relationship between these two statements. Mark answer : 
I. The Government has imported large quantities of sugar as per trade agreement with other countries.
II. The prices of sugar in the domestic market have fallen sharply in the recent months.', jsonb_build_array('Statement I is the cause and statement II is its effect', 'Statement II is the cause and statement I is its effect', 'Both the statements I and II are independent causes', 'Both the statements I and II are effects of independent causes', 'Both the statements I and II are effects of some common cause'), 0, 'The increase in supply always triggers a reduction in the prices.', 6, -1.5),
  (87, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Timid : Ass :: Cunning : ?', jsonb_build_array('Ant', 'Fox', 'Rabbit', 'Horse'), 1, 'Ass is Timid and Fox is Cunning.', 6, -1.5),
  (88, 'nimcet', 'reasoning', 'Reasoning Analogies', 'Easy', 'Supervisor : Worker ::', jsonb_build_array('Junior : Senior', 'Superior : Inferior', 'Elder : Younger', 'Officer : Clerk'), 3, 'Supervisor supervises the Worker in the same way Officer supervises the Clerk.', 6, -1.5),
  (89, 'nimcet', 'reasoning', 'Blood Relations', 'Easy', 'When Anuj saw Manish, he recalled, "He is the son of the father of my daughter''s mother." Who is Manish to Anuj?', jsonb_build_array('Brother-in-law', 'Brother', 'Cousin', 'Uncle'), 0, 'Anuj''s daughter''s mother---Anuj''s wife; Anuj''s wife father---Anu''s father-in-law; Father-in; Father-in-law''s son---Anuj brother-in-law. So, Manish is Anuj''s brother-in-law.', 6, -1.5),
  (90, 'nimcet', 'reasoning', 'Alphanumeric series', 'Easy', 'A series is given with one term missing. Choose the correct alternative from the given ones that will complete the series.
\[ ADG, GJM, ?, SVY\]', jsonb_build_array('MRQ', 'MPS', 'SMP', 'MQS'), 1, 'The series follows a pattern where the first letter increases by 5, the second letter decreases by 6, the third letter increases by 7, and the fourth letter decreases by 8.', 6, -1.5),
  (91, 'nimcet', 'english', 'Meaning of words and phrases', 'Easy', 'Select the most appropriate meaning of the given idiom.
Make a bee line', jsonb_build_array('put the bees in a line', 'look for freebies', 'stand in a queue', 'go straight to'), 3, 'The correct answer is "go straight to"
Key Points
The meaning of the given idiom is "to go quickly and directly at or to (something or someone)"
We use the given idiom in a situation where we are running towards something due to some urgency.
Example: Prateek makes a bee line for the washroom as soon as he realised his pant is torn.
Hence, the correct answer is option 4.
Hinglish 
The meaning of the given idiom is "जल्दी और सीधे जाना या (कुछ या किसी को)"', 4, -1),
  (92, 'nimcet', 'english', 'Comprehension', 'Easy', '​In the following passage some words have been deleted. Fill in the blanks with the help of the alternatives given. Select the most appropriate option for each blank. 
A (1)______ of trucks carrying soldiers was coming down the mountain road. The trucks (2) ______ slowly as there had been heavy snowfall in that area . Suddenly, with a (3) ______ a huge tree on the hill side fell bringing along with it boulders and mud. (4) ______, the driver of first truck stopped in time. The soldiers got down and started (5) ______ the road.
Select the most appropriate option for blank (3).', jsonb_build_array('splash', 'scream', 'crash', 'buzz'), 2, 'The most appropriate option for blank (3) is: 
C. crash 
The sentence would read: 
"Suddenly, with a crash, a huge tree on the hillside fell, bringing along with it boulders and mud." 
"Crash" is the most suitable word here, as it describes the loud, sudden sound made by the falling tree and the debris.', 4, -1),
  (93, 'nimcet', 'english', 'Meaning of words and phrases', 'Easy', 'Select the most appropriate meaning of the given idiom.
In the blink of an eye', jsonb_build_array('Happen fast and instantaneously', 'To make progress', 'To flourish', 'More than one of the above'), 0, 'The correct answer is "Happen fast and instantaneously".
Key Points
"In the blink of an eye" is an idiom that means something happens very quickly.
तेजी से घटित होता है
The phrase can be used to describe events that occur suddenly or unexpectedly.
It can also refer to actions that are completed in a short amount of time.
Example: In the blink of an eye, the robber disappeared from the bank with a bag full of cash. 
Thus, it is clear that option 1 correctly explains the given idiom.
Hence, the correct answer is option 1.', 4, -1),
  (94, 'nimcet', 'english', 'Meaning of words and phrases', 'Easy', 'Directions : Given below are some idioms/phrases followed by four alterative meanings to each. Choose the most appropriate answer from among the options (a), (b), (c) and (d).
Talking twenty to the dozen', jsonb_build_array('talking hurriedly and rapidly', 'talking too much', 'talking without making sense', 'talking out of turn'), 0, 'The correct answer is- ''talking hurriedly and rapidly''
 Key Points
let''s look at the meaning of the given idiom
Talking twenty to the dozen: to speak rapidly and without stopping.(तेजी से और बिना रुके बोलना।)
Example: He showed us around the house while talking nineteen to the dozen.
 My aunt can get talking twenty to the dozen if you get her on a topic she''s passionate about.​​
​From the above lines, we can say that ''talking hurriedly and rapidly'' is the correct meaning of the given idiom.', 4, -1),
  (95, 'nimcet', 'english', 'Synonyms and Antonyms', 'Easy', 'What is an antonym for ''strong''?', jsonb_build_array('Tough', 'Powerful', 'Weak', 'Sturdy'), 2, 'Weak is the opposite of strong. It indicates lack of strength.', 4, -1),
  (96, 'nimcet', 'english', 'Basic English Grammar', 'Easy', 'The following sentence has been split into four segments. Identify the segment that contains a grammatical error.
Rahul sings / very sweet / when he is / in a good mood', jsonb_build_array('very sweet', 'when he is', 'in a good mood', 'Rahul sings'), 0, 'The correct answer is ''very sweet''
Key Points
​Here ''sweet'' is an adjective which qualifies a subject (Noun/ Pronoun)
However, an ''adverb'' is required to modify a Verb
Example- Phillip sings loudly in the shower. 
Thus, ''sweet'' will be replaced by ''sweetly''.
Correct Sentence- Rahul sings very sweetly when he is in a good mood.', 4, -1),
  (97, 'nimcet', 'english', 'Technical Writing', 'Easy', 'A student of class IV says, "After writing the first draft, I read it, make necessary changes and rewrite the draft again." The student is working at the writing stage of:', jsonb_build_array('Brainstorming', 'Listing', 'Proof reading', 'Revising'), 3, 'The writing process typically involves several stages, including planning or prewriting, drafting, revising, editing, and publishing.
Key Points Here''s the chronological order of these stages:
Planning or Prewriting: This stage involves generating ideas, conducting research, outlining the structure, and organizing thoughts before starting the actual writing. 
Drafting: This is where the actual writing takes place, and the ideas and thoughts from the planning stage are transformed into a rough draft or initial version of the piece.
Revising: After completing the draft, the writer proceeds to the revision stage. This involves reviewing and making changes to the content, structure, and organization of the draft to improve clarity, coherence, and overall effectiveness. 
Editing: Once the revision stage is done, editing focuses on correcting grammar, spelling, punctuation, and other mechanical errors. 
Publishing: The final step of the writing process is publishing. This can involve sharing the work with others, submitting it for publication, or making it available to the intended audience.
Therefore, the student is working at the writing stage of revising.', 4, -1),
  (98, 'nimcet', 'english', 'Basic English Grammar', 'Easy', 'Select the alternative that will improve the underlined part of the sentence. In case there is no improvement select ‘No improvement’.
Sidharth want to become a football player but needs to practice more rigorously.', jsonb_build_array('wanted becoming', 'wants to become', 'is wanting to become', 'No improvement'), 1, 'The correct answer is - wants to become.
Key Points
The simple present tense is used when an action is happening right now, to state or ask about things in general, or when it happens regularly or unceasingly.
The structure is given below:
Subject + V1 + object.
The verb will take ''s/es'' if the given noun/pronoun (3rd person) is singular.
Example:
​He plays badminton daily.​
Certain verbs used only in the simple present tense are given below:
​verbs of perception (see, hear, smell, etc.), think, know, has/have, possess, like, want, desire, hate, seem, imagine, etc.
Example:
​My brother is owning a car. (incorrect)
​My brother owns a car. (correct)
As per the rules given above, the 2nd option i.e. wants to become is the correct choice.
Correct Sentence: Sidharth wants to become a football player but needs to practice more rigorously.', 4, -1),
  (99, 'nimcet', 'english', 'Word Power', 'Easy', 'Choose the option which does not belong to the group (ODD-ONE-OUT).', jsonb_build_array('dull', 'gloomy', 'omnipresent', 'boring'), 2, 'Omnipresent does not belong to the group of dull (a), gloomy (depressed, sullen, dismal, depressing, dark) (b) and boring (d); they are synonyms. Except (c), all other options are wrong. Share this question with your friends', 4, -1),
  (100, 'nimcet', 'english', 'Meaning of words and phrases', 'Easy', 'Direction: Choose the correct alternative mentioned below:
A bolt from the blue', jsonb_build_array('An unexpected and unpleasant event', 'An inexplicable event', 'A delayed event', 'An unpleasant event'), 0, 'The correct answer is: ''An unexpected and unpleasant event''.
Key Points
 The given Idiom is: ''A bolt from the blue''.(आकस्मिक घटना)
The Idiom ''A bolt from the blue'' means something important or unusual that happens suddenly or unexpectedly.
Example: The resignation of the chairman came like a bolt from the blue.
Hence, the correct option of the given idiom is: ''An unexpected and unpleasant event''.(एक अप्रत्याशित और अप्रिय घटना)
Therefore, the correct option is: ''Option 1''.
Additional Information
 ''An inexplicable event'' means an event which cannot be described in words.(एक अकथनीय घटना)
''A delayed event'' means an event which is late in time.(एक विलंबित घटना)
''An unpleasant event'' means an event which is not pleasant.(एक अप्रिय घटना)', 4, -1),
  (101, 'nimcet', 'computer', 'Organization of a computer', 'Easy', 'When 1,0 are two inputs given to the AND, OR gates then the outputs respectively are', jsonb_build_array('0, 0', '0, 1', '1, 0', '1, 1'), 1, '1 AND 0 = 0 1 OR 0 = 1', 6, -1.5),
  (102, 'nimcet', 'computer', 'Number representations', 'Easy', 'The octal number 24 is equivalent to which binary number?', jsonb_build_array('11000', '10001', '100100', '10100'), 3, 'The octal number 24 is equivalent to binary 10100.', 6, -1.5),
  (103, 'nimcet', 'computer', 'Central Processing Unit (CPU)', 'Easy', 'What is the function of the CPU''s Arithmetic Logic Unit (ALU)?', jsonb_build_array('To control input and output operations', 'To perform mathematical and logical operations', 'To store data permanently', 'To display images on the screen'), 1, 'The ALU (Arithmetic Logic Unit) in the CPU is responsible for performing mathematical and logical operations.', 6, -1.5),
  (104, 'nimcet', 'computer', 'Organization of a computer', 'Easy', 'The drawback of building a large memory with DRAM is ______________', jsonb_build_array('The Slow speed of operation', 'The large cost factor', 'The inefficient memory organisation', 'All of the mentioned'), 0, 'The DRAMs were used for large memory modules for a long time until a substitute was found.', 6, -1.5),
  (105, 'nimcet', 'computer', 'Organization of a computer', 'Easy', 'Which of the following is a reason for process suspension instead of termination?', jsonb_build_array('Invalid Instruction', 'Memory Unavailble', 'Privileged Instruction', 'Interactive user request'), 1, 'A process is terminated when the system is unable to provide the memory required, as it is more than the memory that it is actually contained in the system', 6, -1.5),
  (106, 'nimcet', 'computer', 'Structure of instructions in CPU', 'Easy', 'Which register in CPU stores the instruction currently being executed?', jsonb_build_array('Memory address register (MAR)', 'Program counter (PC)', 'Instruction register (IR)', 'Memory data register (MDR)'), 2, 'The correct answer is Instruction register (IR). The Instruction Register (IR) in the CPU stores the instruction that is currently being executed. After fetching the instruction from memory, it is placed in the IR for decoding and execution.', 6, -1.5),
  (107, 'nimcet', 'computer', 'Computer memory', 'Easy', 'Permanent Memory of a computer is known as-', jsonb_build_array('RAM', 'CD-ROM', 'ROM', 'CPU'), 2, 'The Correct Answer is ROM.
Key Points
The permanent memory of a computer is known as ROM(Read-only memory).
In computers and other electronic devices, read-only memory (ROM) is a form of non-volatile memory.
After the memory unit is manufactured, data contained in ROM cannot be electronically changed. Read-only memory, also known as firmware, is useful for storing software that is rarely updated during the life of the device.
Plug-in cartridges containing ROM can be used to distribute software applications (such as video games) for programmable computers.
Read-only memory refers to memory that is hard-wired and cannot be modified electronically after manufactures, such as a diode matrix or a mask ROM integrated circuit (IC).
Additional Information
The memory is permanently installed on your computer. This is a read-only memory. The working memory of a computer, also known as random-access memory. The hardware allows data to be passed through a device. 
Random-access memory (RAM) is a type of computer memory that allows data and machine code to be read and modified in any order. It is commonly used to store working data and machine code.
A CD-ROM is a data-containing optical compact disc that has been pre-pressed. CD-ROMs are a form of read-only memory that computers can read but not write to or delete.
The electronic circuitry that executes instructions in a computer programme is known as a central processing unit (CPU), also known as a central processor, main processor, or simply processor.', 6, -1.5),
  (108, 'nimcet', 'computer', 'Input/output devices', 'Easy', 'Which of the following memory unit is the first to get active when the computer is turned on?', jsonb_build_array('Main memory', 'BIOS chip', 'Cache memory', 'Secondary memory'), 1, 'The correct option is B. BIOS means Basic Input Output System. BIOS helps to perform the hardware test (POST) and initialize the booting sequence when the computer is turned on.', 6, -1.5),
  (109, 'nimcet', 'computer', 'Computer memory', 'Easy', 'Which of the following is used in main memory?', jsonb_build_array('DDR', 'DRAM', 'SRAM', 'PRAM'), 1, 'The correct answer is DRAM.
Key Points
DRAM:
It is dynamic random access memory and is widely used as a computer''s main memory. Hence, Option 2 is correct.
Each DRAM memory cell is made up of a transistor and a capacitor within an integrated circuit, and a data bit is stored in the capacitor.
DDR-RAM:
It stands for Double Data Rate Synchronous Dynamic Random-Access Memory. 
These are the computer memory that transfers the data twice as fast as regular chips like SDRAM chips because DDR memory can send and receive signals twice per clock cycle as a comparison.
SRAM:
It stands for Static Random Access Memory.
It is a form of a semiconductor.
It is widely used in microprocessors, general computing applications, and electronic devices.
The SRAM is volatile in nature which means the data stored in it gets all wiped out once the power supply is cut.
SRAM is comprised of flip-flops. 
PRAM:
In computer science, a parallel random-access machine is a shared-memory abstract machine.
As its name indicates, the PRAM is intended as the parallel-computing analogy to the random-access machine.', 6, -1.5),
  (110, 'nimcet', 'computer', 'Boolean algebra', 'Easy', 'The involution of A is equal to _________', jsonb_build_array('A', '2', '1', '0'), 0, 'The involution of A means double inversion of A (i.e. A) and is equal to A.', 6, -1.5),
  (111, 'nimcet', 'computer', 'Central Processing Unit (CPU)', 'Easy', 'Which of the following is not a function of the CPU?', jsonb_build_array('Fetching instructions from memory', 'Decoding instructions', 'Executing instructions', 'Storing data permanently'), 3, 'Storing data permanently is not a function of the CPU; it is typically done by storage devices such as hard drives.', 6, -1.5),
  (112, 'nimcet', 'computer', 'Number representations', 'Easy', 'What is the binary number for decimal number 9?', jsonb_build_array('1100', '1001', '0111', '1011'), 1, 'To convert the decimal number \( 9 \) to binary, we repeatedly divide the number by \( 2 \) and record the remainders:
 1. \( 9 \div 2 = 4 \) remainder \( 1 \) 
 2. \( 4 \div 2 = 2 \) remainder \( 0 \) 
 3. \( 2 \div 2 = 1 \) remainder \( 0 \) 
 4. \( 1 \div 2 = 0 \) remainder \( 1 \) 
 Now, read the remainders from bottom to top: \( 1001 \).
 Final Answer:
The binary equivalent of the decimal number \( 9 \) is:
\[
1001_2
\]', 6, -1.5),
  (113, 'nimcet', 'computer', 'Computer memory', 'Easy', 'Which of the following, which is the fastest ?', jsonb_build_array('CD-ROM', 'RAM', 'Registers', 'Cache'), 2, 'Registers are the fastest form of memory, followed by cache memory, RAM, and then secondary storage devices like CD-ROMs.', 6, -1.5),
  (114, 'nimcet', 'computer', 'Input/output devices', 'Easy', 'Punched cards are used in _______________', jsonb_build_array('Low speed computers', 'High speed computers', 'Super computers', 'Mac devices'), 0, 'The correct answer is Low speed computers. Punched cards were used in early computing systems, particularly in low-speed computers, for data input and storage. These cards had holes punched in them to represent data, and they were read by machines. They were eventually replaced by more efficient and faster data storage methods.', 6, -1.5),
  (115, 'nimcet', 'computer', 'Central Processing Unit (CPU)', 'Easy', 'The part of a processor which contains hardware necessary to perform all the operations required by a computer:', jsonb_build_array('Data path', 'Controller', 'Registers', 'Cache'), 0, 'For explanation I would say: A processor is a part of the computer which does all the data manipulation and decision making. A processor comprises of: A data path which contains the hardware necessary to perform all the operations. A controller tells the data path what needs to be done. The registers act as intermediate storage for the data.', 6, -1.5),
  (116, 'nimcet', 'computer', 'Number representations', 'Easy', 'The octal number 64.5 is equivalent to which binary number?', jsonb_build_array('110010.101', '110110.000', '110100.101', '111000.011'), 2, 'The octal number 64 is equivalent to binary 110100, and 0.5 in octal is 0.101 in binary. So, the binary equivalent of 64.5 is 110100.1.', 6, -1.5),
  (117, 'nimcet', 'computer', 'Boolean algebra', 'Easy', 'The boolean function A + BC is a reduced form of ____________', jsonb_build_array('AB + BC', '(A + B)(A + C)', 'AB + ABC', '(A + C)B'), 1, 'None.', 6, -1.5),
  (118, 'nimcet', 'computer', 'Computer memory', 'Easy', '________ is a supplementary memory system which stores frequently used instructions and data for quicker processing.', jsonb_build_array('Cache memory', 'RAM', 'Register', 'Hard disk'), 0, 'The correct answer is Cache memoryKey Points
The correct answer is Cache memory.
Quick Access: Cache memory stores copies of frequently used data coming from the slower main memory (RAM). It''s closer to the CPU, which makes fetching commands quicker and overall process much faster. Utilizing cache improves system performance because it can access this data faster than it could from the main memory.
Temporal Locality: Cache memory operates on the principle of locality of reference, specifically the temporal locality, which states that if data is referenced once, it''s likely to be referenced again soon. Therefore, storing this frequently used data in cache reduces time-consuming operations and increases efficiency.
Different Levels: There are different levels of cache memory (L1, L2, L3) with varying sizes and speeds. L1 cache is the smallest and fastest, located inside the processor chip. L2 and L3 caches are bigger and slightly slower, but still much faster than accessing data from RAM or a hard drive. The different levels allow systems to effectively optimize speed and cost.
Additional Information
Random Access Memory: 
It''s a volatile type of memory that stores data currently being used by the operating system and programs.
Without enough RAM, your computer will experience slowdowns and performance issues.
Computer register:
This refers to a small, high-speed storage location within a computer''s Central Processing Unit (CPU) used to hold data or instructions that are currently being processed.
Different types of registers exist, each with specific functions.
Data register: This is a system for recording and storing information, often used in databases, organizations, or for research purposes. Examples include voter registration, product registration, or patient medical records.
Control register: This type of register stores control signals or settings that govern the operation of a device or system. It might define operating modes, communication protocols, or other configuration parameters.
Hard disk:
The hard disk is the electromagnetic storage. It is the secondary storage of computers.
It stores and retrieves data in the form of magnetic storage. It has one or more platters.
It has a circular metal disk that is mounted inside the hard disk. It has electromagnetic read or writes heads which are called Magnetic heads.', 6, -1.5),
  (119, 'nimcet', 'computer', 'Number representations', 'Easy', 'Which of the following is not a weighted code?', jsonb_build_array('Decimal Number system', 'Excess 3 Code', 'Binary number System', 'None of these'), 1, '', 6, -1.5),
  (120, 'nimcet', 'computer', 'Input/output devices', 'Easy', 'Which of the following characteristics make ROM (Read Only memory) more significant in the computer system?', jsonb_build_array('ROM provides a large amount of capacity to store your data permanently.', 'ROM is easily upgradable.', 'It is non-volatile in nature, hence data stored in ROM remains as it is even the system is powered off.', 'All of the above.'), 2, 'The correct option is C.', 6, -1.5);

-- 3. Fail loudly when the target test is missing (aborts everything — nothing is written).
do $$
begin
  if not exists (select 1 from public.tests where title = 'NIMCET MOCK - 01') then
    raise exception 'No test titled "%" found. Copy the exact title from Table Editor → tests and regenerate this file with that title — nothing was written.', 'NIMCET MOCK - 01';
  end if;
end $$;

-- 4. Insert only questions that do not exist yet (matched by exact stem).
insert into public.questions (exam, section, topic, difficulty, stem, options, answer, explanation, plus, minus)
select s.exam, s.section, s.topic, s.difficulty, s.stem, s.options, s.answer, s.explanation, s.plus, s.minus
from seed_import s
where not exists (select 1 from public.questions q where q.stem = s.stem);

-- 5. Rebuild the target test's question list in CSV order (same row id, so
--    attempt history stays intact).
update public.tests t set
  question_ids = (select array_agg(x.id order by s.seq)
                    from seed_import s
                    join lateral (
                      select q.id from public.questions q
                      where q.stem = s.stem
                      order by q.created_at
                      limit 1
                    ) x on true)
where t.title = 'NIMCET MOCK - 01';

-- 6. Verification — these result sets show what the run did.
select s.section,
       count(*)      as questions,
       min(s.plus)   as marks_per_correct,
       min(s.minus)  as marks_per_wrong,
       sum(s.plus)   as max_marks
from seed_import s
group by s.section
order by min(s.seq);

select count(*) as staged_questions, sum(s.plus) as staged_max_marks from seed_import s;

select t.id, t.title, t.published, t.minutes,
       array_length(t.question_ids, 1) as linked_questions,
       t.sections
from public.tests t
where t.title = 'NIMCET MOCK - 01';

commit;
