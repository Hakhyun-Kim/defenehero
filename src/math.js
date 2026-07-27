/* =====================================================
 * 수학 문제 생성기 (3학년 ~ 6학년) × 난이도 5단계
 * gen(grade, lv) -> { text, answer, hint, lv, grade }
 *
 * 학년 = "무엇을 묻는가"(교과 범위), 난이도(lv) = "얼마나 조이는가".
 * lv은 조합 난이도에서 온다 — 강한 용사를 만들수록 문제가 어려워진다.
 * 같은 학년 안에서 ① 수의 크기 ② 연산 단계 수 가 함께 올라간다.
 *  - hint: 풀이 전략 + 정답 첫 숫자. 사면 골드가 나가고 환급이 사라진다.
 * ===================================================== */
const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[ri(0, arr.length - 1)];
/* 소수 계산은 반드시 정수로 만든 뒤 나눈다 — 0.1+0.2 문제를 원천 차단 */
const r2 = (v) => Math.round(v * 100) / 100;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

const firstDigit = (ans) => String(Math.abs(ans)).replace('.', '')[0];
const digitHint = (ans) => {
  const s = String(Math.abs(ans));
  return s.includes('.')
    ? `정답에 소수점이 있어요. 맨 앞 숫자는 ${firstDigit(ans)}!`
    : `정답은 ${s.length}자리 수예요. 맨 앞 숫자는 ${firstDigit(ans)}!`;
};

/* ---------- 게임 테마 문장형 문제 ---------- */
function wordWrap(op, a, b, ans) {
  const tmpl = {
    add: [
      `용사가 골드를 ${a}개, 보석을 ${b}개 모았어요.\n모두 몇 개일까요?`,
      `성 안에 병사가 ${a}명 있는데 ${b}명이 더 왔어요.\n모두 몇 명일까요?`,
    ],
    sub: [
      `몬스터 ${a}마리 중에서 ${b}마리를 물리쳤어요.\n몇 마리가 남았을까요?`,
      `골드가 ${a}개 있었는데 ${b}개를 썼어요.\n몇 개가 남았을까요?`,
    ],
    mul: [
      `화살통 하나에 화살이 ${b}발씩 들어 있어요.\n화살통 ${a}개에는 화살이 모두 몇 발일까요?`,
      `용사 한 명이 몬스터를 ${b}마리씩 물리쳤어요.\n용사 ${a}명은 모두 몇 마리를 물리쳤을까요?`,
    ],
    div: [
      `골드 ${a}개를 용사 ${b}명이 똑같이 나누어 가져요.\n한 명이 몇 개씩 가질까요?`,
      `물약 ${a}개를 상자 ${b}개에 똑같이 나누어 담아요.\n상자 하나에 몇 개씩 담을까요?`,
    ],
  };
  const opHint = {
    add: `덧셈 문제예요: ${a} + ${b}. `,
    sub: `뺄셈 문제예요: ${a} − ${b}. `,
    mul: `곱셈 문제예요: ${a} × ${b}. `,
    div: `나눗셈 문제예요: ${a} ÷ ${b}. `,
  };
  return { text: pick(tmpl[op]), answer: ans, hint: opHint[op] + digitHint(ans) };
}

function maybeWord(op, a, b, ans, plain, plainHint) {
  if (Math.random() < 0.35) return wordWrap(op, a, b, ans);
  return { text: plain, answer: ans, hint: plainHint };
}

/* =====================================================
 * 문제 유형 표
 *   min : 이 난이도부터 등장 (= 난이도가 오르면 새 유형이 "해금"된다)
 *   make(lv) : 실제 문제 생성 (같은 유형 안에서도 lv이 오르면 수가 커진다)
 * ===================================================== */

/* ---------- 3학년: 세 자리 덧셈·뺄셈 / 곱셈 / 나눗셈 ---------- */
const G3 = [
  {
    id: 'add2', min: 1, make: () => {
      const a = ri(23, 89), b = ri(14, 89);
      return maybeWord('add', a, b, a + b, `${a} + ${b} = ?`,
        `일의 자리부터 더하고, 10이 넘으면 받아올림! ${digitHint(a + b)}`);
    },
  },
  {
    id: 'sub2', min: 1, make: () => {
      const a = ri(42, 98), b = ri(13, a - 11);
      return maybeWord('sub', a, b, a - b, `${a} − ${b} = ?`,
        `일의 자리부터 빼요. 모자라면 십의 자리에서 10을 빌려와요! ${digitHint(a - b)}`);
    },
  },
  {
    id: 'div1', min: 1, make: () => {
      const b = ri(2, 9), q = ri(3, 9), a = b * q;
      return maybeWord('div', a, b, q, `${a} ÷ ${b} = ?`,
        `구구단 ${b}단을 떠올려요! ${b} × 몇 = ${a} 일까요?`);
    },
  },
  {
    id: 'add3', min: 2, make: () => {
      const a = ri(123, 867), b = ri(102, 999 - a);
      return maybeWord('add', a, b, a + b, `${a} + ${b} = ?`,
        `일의 자리부터 차례대로 더해요. 받아올림 조심! ${digitHint(a + b)}`);
    },
  },
  {
    id: 'sub3', min: 2, make: () => {
      const a = ri(310, 985), b = ri(102, a - 105);
      return maybeWord('sub', a, b, a - b, `${a} − ${b} = ?`,
        `일의 자리부터 빼요. 모자라면 윗자리에서 10을 빌려와요! ${digitHint(a - b)}`);
    },
  },
  {
    id: 'mul21', min: 2, make: (lv) => {
      const a = lv >= 4 ? ri(34, 89) : ri(12, 33), b = ri(3, 9);
      return maybeWord('mul', a, b, a * b, `${a} × ${b} = ?`,
        `${a}를 ${Math.floor(a / 10) * 10} + ${a % 10}으로 나눠서 각각 ${b}를 곱한 뒤 더해요. ${digitHint(a * b)}`);
    },
  },
  {
    id: 'divRem', min: 3, make: () => {
      const b = ri(3, 9), q = ri(4, 9), r = ri(1, b - 1);
      const a = b * q + r;
      return {
        text: `${a} ÷ ${b} 의 나머지는 얼마일까요?`, answer: r,
        hint: `${b}단에서 ${a}를 넘지 않는 가장 큰 수는 ${b * q}. 남는 만큼이 나머지예요.`,
      };
    },
  },
  {
    id: 'triple', min: 4, make: () => {
      const a = ri(120, 480), b = ri(110, 390), c = ri(60, a);
      return {
        text: `${a} + ${b} − ${c} = ?`, answer: a + b - c,
        hint: `앞에서부터 차례대로! 먼저 ${a} + ${b} = ${a + b}, 거기서 ${c}를 빼요.`,
      };
    },
  },
  {
    id: 'missing', min: 4, make: () => {
      const a = ri(125, 480), x = ri(115, 460);
      return {
        text: `${a} + ⬜ = ${a + x}\n⬜ 에 들어갈 수는?`, answer: x,
        hint: `덧셈의 반대는 뺄셈! ${a + x} − ${a} 를 계산해요. ${digitHint(x)}`,
      };
    },
  },
  {
    id: 'mul31', min: 5, make: () => {
      const a = ri(112, 489), b = ri(4, 9);
      return {
        text: `${a} × ${b} = ?`, answer: a * b,
        hint: `일의 자리부터 곱하고 받아올림을 더해요. ${digitHint(a * b)}`,
      };
    },
  },
  {
    id: 'missingMul', min: 5, make: () => {
      const b = ri(3, 9), x = ri(12, 39);
      return {
        text: `⬜ × ${b} = ${b * x}\n⬜ 에 들어갈 수는?`, answer: x,
        hint: `곱셈의 반대는 나눗셈! ${b * x} ÷ ${b} 를 계산해요. ${digitHint(x)}`,
      };
    },
  },
];

/* ---------- 4학년: 큰 수 / (두·세 자리)×(두 자리) / 두 자리로 나누기 ---------- */
const G4 = [
  {
    id: 'mul22', min: 1, make: () => {
      const a = ri(12, 29), b = ri(11, 24);
      return maybeWord('mul', a, b, a * b, `${a} × ${b} = ?`,
        `${a} × ${b} = ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} 으로 나눠 계산해요. ${digitHint(a * b)}`);
    },
  },
  {
    id: 'mul31', min: 1, make: () => {
      const a = ri(112, 389), b = ri(3, 7);
      return {
        text: `${a} × ${b} = ?`, answer: a * b,
        hint: `일의 자리부터 곱하고 받아올림을 더해요. ${digitHint(a * b)}`,
      };
    },
  },
  {
    id: 'div2', min: 1, make: () => {
      const b = ri(12, 25), q = ri(3, 9);
      return maybeWord('div', b * q, b, q, `${b * q} ÷ ${b} = ?`,
        `${b} × 몇 = ${b * q} 일까요? ${b}씩 몇 번 묶을 수 있는지 세어 봐요.`);
    },
  },
  {
    id: 'bigAdd', min: 2, make: () => {
      const a = ri(1250, 7800), b = ri(1020, 9999 - a);
      return {
        text: `${a} + ${b} = ?`, answer: a + b,
        hint: `천의 자리까지 자리를 맞춰 더해요. ${digitHint(a + b)}`,
      };
    },
  },
  {
    id: 'bigSub', min: 2, make: () => {
      const a = ri(3200, 9850), b = ri(1120, a - 1050);
      return {
        text: `${a} − ${b} = ?`, answer: a - b,
        hint: `자리를 맞춰 일의 자리부터 빼요. ${digitHint(a - b)}`,
      };
    },
  },
  {
    id: 'mul22b', min: 3, make: () => {
      const a = ri(32, 79), b = ri(23, 49);
      return {
        text: `${a} × ${b} = ?`, answer: a * b,
        hint: `${a} × ${Math.floor(b / 10) * 10} 와 ${a} × ${b % 10} 을 각각 구해서 더해요. ${digitHint(a * b)}`,
      };
    },
  },
  {
    id: 'divRem2', min: 3, make: () => {
      const b = ri(12, 28), q = ri(4, 9), r = ri(1, b - 1);
      const a = b * q + r;
      return {
        text: `${a} ÷ ${b} = ${q} … ⬜\n나머지 ⬜ 는 얼마일까요?`, answer: r,
        hint: `${b} × ${q} = ${b * q}. ${a}에서 ${b * q}를 빼면 나머지가 나와요.`,
      };
    },
  },
  {
    id: 'div3', min: 4, make: () => {
      const b = ri(13, 32), q = ri(11, 38);
      return {
        text: `${b * q} ÷ ${b} = ?`, answer: q,
        hint: `몫이 두 자리예요. 십의 자리부터 세워서 나눠요. ${digitHint(q)}`,
      };
    },
  },
  {
    id: 'missing', min: 4, make: () => {
      const b = ri(12, 29), x = ri(14, 48);
      return {
        text: `⬜ × ${b} = ${b * x}\n⬜ 에 들어갈 수는?`, answer: x,
        hint: `곱셈의 반대는 나눗셈! ${b * x} ÷ ${b} 를 계산해요. ${digitHint(x)}`,
      };
    },
  },
  {
    id: 'mul32', min: 5, make: () => {
      const a = ri(112, 468), b = ri(23, 68);
      return {
        text: `${a} × ${b} = ?`, answer: a * b,
        hint: `${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}, 여기에 ${a} × ${b % 10} 을 더해요.`,
      };
    },
  },
  {
    id: 'bigTriple', min: 5, make: () => {
      const a = ri(2400, 6800), b = ri(1200, 3000), c = ri(800, 2600);
      return {
        text: `${a} + ${b} − ${c} = ?`, answer: a + b - c,
        hint: `앞에서부터! ${a} + ${b} = ${a + b}, 거기서 ${c}를 빼요.`,
      };
    },
  },
];

/* ---------- 5학년: 혼합 계산 / 소수 / 평균 / 약수와 배수 ---------- */
const G5 = [
  {
    id: 'mix1', min: 1, make: (lv) => {
      const b = ri(3, 9), c = ri(3, 9), a = ri(10, 30 + lv * 15);
      return {
        text: `${a} + ${b} × ${c} = ?`, answer: a + b * c,
        hint: `곱셈을 먼저! ${b} × ${c} = ${b * c}, 거기에 ${a}를 더해요.`,
      };
    },
  },
  {
    id: 'dec1', min: 1, make: () => {
      const A = ri(105, 899), B = ri(101, 880);
      if (Math.random() < 0.5) {
        return {
          text: `${A / 100} + ${B / 100} = ?`, answer: r2((A + B) / 100),
          hint: `소수점 자리를 맞춰 세로로 더해요. ${digitHint(r2((A + B) / 100))}`,
        };
      }
      const big = Math.max(A, B), small = Math.min(A, B) - 1;
      return {
        text: `${big / 100} − ${small / 100} = ?`, answer: r2((big - small) / 100),
        hint: `소수점 자리를 맞춰 세로로 빼요. ${digitHint(r2((big - small) / 100))}`,
      };
    },
  },
  {
    id: 'mix2', min: 2, make: () => {
      if (Math.random() < 0.5) {
        const b = ri(3, 9), c = ri(3, 9), a = b * c + ri(5, 60);
        return {
          text: `${a} − ${b} × ${c} = ?`, answer: a - b * c,
          hint: `곱셈을 먼저! ${b} × ${c} = ${b * c}, ${a}에서 그만큼 빼요.`,
        };
      }
      const a = ri(5, 25), b = ri(5, 25), c = ri(3, 8);
      return {
        text: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c,
        hint: `괄호 안을 먼저! ${a} + ${b} = ${a + b}, 거기에 ${c}를 곱해요.`,
      };
    },
  },
  {
    id: 'decMul', min: 2, make: () => {
      const A = ri(11, 89), b = ri(3, 9);
      return {
        text: `${A / 10} × ${b} = ?`, answer: r2((A * b) / 10),
        hint: `먼저 ${A} × ${b} = ${A * b} 를 구하고, 소수점을 한 칸 찍어요.`,
      };
    },
  },
  {
    id: 'avg', min: 2, make: () => {
      const m = ri(12, 60);
      const d1 = ri(-8, 8), d2 = ri(-8, 8), d3 = ri(-8, 8);
      const nums = [m + d1, m + d2, m + d3, m - d1 - d2 - d3];
      return {
        text: `네 수 ${nums.join(', ')} 의 평균은?`, answer: m,
        hint: `평균 = (모두 더한 값) ÷ 4. 합은 ${nums.reduce((a, b) => a + b, 0)} 이에요.`,
      };
    },
  },
  {
    id: 'gcd', min: 3, make: () => {
      const g = ri(4, 12), a = g * ri(2, 7), b = g * ri(2, 7);
      if (a === b) return { text: `${a} 와 ${a + g} 의 최대공약수는?`, answer: gcd(a, a + g), hint: `두 수를 모두 나누어떨어지게 하는 가장 큰 수를 찾아요.` };
      return {
        text: `${a} 와 ${b} 의 최대공약수는?`, answer: gcd(a, b),
        hint: `두 수를 각각 소인수로 쪼개고 공통인 것만 곱해요. (${a} = ${g} × ${a / g}, ${b} = ${g} × ${b / g})`,
      };
    },
  },
  {
    id: 'lcm', min: 3, make: () => {
      const a = ri(4, 15), b = ri(4, 15);
      return {
        text: `${a} 와 ${b} 의 최소공배수는?`, answer: lcm(a, b),
        hint: `${a}의 배수를 늘어놓다가 ${b}로도 나누어떨어지는 첫 수! (최대공약수는 ${gcd(a, b)})`,
      };
    },
  },
  {
    id: 'mix3', min: 4, make: () => {
      const a = ri(6, 20), b = ri(4, 18), c = ri(3, 8), d = ri(5, 40);
      const ans = (a + b) * c - d;
      return {
        text: `(${a} + ${b}) × ${c} − ${d} = ?`, answer: ans,
        hint: `① 괄호 ${a} + ${b} = ${a + b} ② × ${c} = ${(a + b) * c} ③ − ${d}`,
      };
    },
  },
  {
    id: 'decMul2', min: 4, make: () => {
      const A = ri(12, 89), B = ri(12, 49);
      return {
        text: `${A / 10} × ${B / 10} = ?`, answer: r2((A * B) / 100),
        hint: `소수점을 빼고 ${A} × ${B} = ${A * B}. 소수점이 모두 두 칸이니 두 칸 찍어요.`,
      };
    },
  },
  {
    id: 'mix4', min: 5, make: () => {
      const a = ri(4, 12), b = ri(3, 9), c = ri(3, 9), d = ri(2, 8);
      const e = d * ri(2, 9);
      const ans = a * b + e / d - c;
      return {
        text: `${a} × ${b} + ${e} ÷ ${d} − ${c} = ?`, answer: ans,
        hint: `곱셈·나눗셈 먼저! ${a} × ${b} = ${a * b}, ${e} ÷ ${d} = ${e / d}. 그 다음 더하고 빼요.`,
      };
    },
  },
  {
    id: 'avgMiss', min: 5, make: () => {
      const m = ri(15, 60);
      const a = m + ri(-9, 9), b = m + ri(-9, 9), c = m + ri(-9, 9);
      const x = m * 4 - (a + b + c);
      return {
        text: `${a}, ${b}, ${c}, ⬜ 네 수의 평균이 ${m} 이에요.\n⬜ 는 얼마일까요?`, answer: x,
        hint: `네 수의 합은 ${m} × 4 = ${m * 4}. 거기서 ${a} + ${b} + ${c} = ${a + b + c} 를 빼요.`,
      };
    },
  },
];

/* ---------- 6학년: 분수·소수 나눗셈 / 비와 비율 / 백분율 ---------- */
const G6 = [
  {
    id: 'fracDiv', min: 1, make: () => {
      let a, k, num, b;
      /* 분모가 같아야 하는 단원이라 분자만 정한다.
       * gcd(num,b)=1 이면 a도 num의 약수라 두 분수 모두 기약분수가 된다 —
       * 4/6 ÷ 2/6 처럼 약분되는 꼴은 교과서에 안 나온다. */
      do {
        a = ri(1, 4); k = ri(2, 4);
        num = a * k;
        b = ri(num + 1, num + 6);
      } while (gcd(num, b) !== 1);
      return {
        text: `{${num}/${b}} ÷ {${a}/${b}} = ?`, answer: k,
        hint: `분모가 같은 분수의 나눗셈은 분자끼리! ${num} ÷ ${a} 를 계산해요.`,
      };
    },
  },
  {
    id: 'decDiv', min: 1, make: () => {
      const d = ri(2, 9), q = ri(3, 14);
      const dividend = r2((d * q) / 10);
      return {
        text: `${dividend} ÷ ${d / 10} = ?`, answer: q,
        hint: `둘 다 10배 해서 소수점을 없애요: ${d * q} ÷ ${d} 와 같아요.`,
      };
    },
  },
  {
    id: 'pct', min: 1, make: () => {
      const bases = [20, 40, 60, 80, 120, 160, 200, 240, 300];
      const ps = [5, 10, 15, 20, 25, 50, 75];
      let b, p;
      do { b = pick(bases); p = pick(ps); } while ((b * p) % 100 !== 0);
      return {
        text: `${b} 의 ${p}% 는 얼마일까요?`, answer: (b * p) / 100,
        hint: `${p}% 는 {${p}/100} 이에요. ${b} × ${p} ÷ 100 을 계산해요.`,
      };
    },
  },
  {
    id: 'pctOf', min: 2, make: () => {
      const bases = [20, 25, 40, 50, 80, 100, 200];
      const ps = [10, 20, 25, 30, 40, 50, 60, 75, 80];
      let b, p;
      do { b = pick(bases); p = pick(ps); } while ((b * p) % 100 !== 0);
      const x = (b * p) / 100;
      return {
        text: `${x} 은(는) ${b} 의 몇 % 일까요?\n(숫자만 쓰세요)`, answer: p,
        hint: `${x} ÷ ${b} × 100 을 계산하면 몇 %인지 나와요.`,
      };
    },
  },
  {
    id: 'natFrac', min: 2, make: () => {
      let a, b;
      do { b = ri(2, 6); a = ri(2, 5); } while (gcd(a, b) !== 1);   // 3/6 같은 약분 가능 분수 배제
      const n = a * ri(2, 5);
      return {
        text: `${n} ÷ {${a}/${b}} = ?`, answer: (n * b) / a,
        hint: `분수로 나누는 건 뒤집어 곱하기! ${n} × {${b}/${a}} 를 계산해요.`
          + (a > b ? '' : ` (1보다 작은 수로 나누면 몫이 커져요!)`),
      };
    },
  },
  {
    id: 'discount', min: 3, make: () => {
      const price = pick([1200, 1500, 2000, 2400, 3000, 4000, 5000, 8000]);
      const p = pick([10, 15, 20, 25, 30, 40, 50]);
      const off = (price * p) / 100;
      return {
        text: `${price}원짜리 물약을 ${p}% 할인해서 팔아요.\n얼마에 살 수 있을까요?`, answer: price - off,
        hint: `① 할인 금액 = ${price} × ${p} ÷ 100 = ${off} ② ${price} − ${off}`,
      };
    },
  },
  {
    id: 'ratio', min: 3, make: () => {
      const a = ri(2, 7), b = ri(2, 7);
      const unit = ri(4, 20);
      const total = (a + b) * unit;
      return {
        text: `골드 ${total}개를 용사 둘이 ${a} : ${b} 로 나눠 가져요.\n${a > b ? '많이' : '적게'} 받는 쪽은 몇 개일까요?`,
        answer: Math.max(a, b) * unit,
        hint: `전체를 ${a + b}묶음으로 봐요. 한 묶음 = ${total} ÷ ${a + b} = ${unit}. 거기에 ${Math.max(a, b)}을 곱해요.`,
      };
    },
  },
  {
    id: 'circle', min: 4, make: () => {
      const r = ri(2, 12);
      return {
        text: `반지름이 ${r}cm 인 원의 넓이는?\n(원주율 3.14, 단위 없이 숫자만)`, answer: r2(r * r * 3.14),
        hint: `원의 넓이 = 반지름 × 반지름 × 3.14 = ${r} × ${r} × 3.14`,
      };
    },
  },
  {
    id: 'pctUp', min: 4, make: () => {
      const base = pick([200, 400, 500, 800, 1200, 1500, 2000]);
      const p = pick([5, 10, 15, 20, 25, 30, 50]);
      const up = (base * p) / 100;
      return {
        text: `용사의 공격력 ${base} 이 ${p}% 올랐어요.\n지금 공격력은 얼마일까요?`, answer: base + up,
        hint: `① 오른 양 = ${base} × ${p} ÷ 100 = ${up} ② ${base} + ${up}`,
      };
    },
  },
  {
    id: 'ratio3', min: 5, make: () => {
      const a = ri(1, 5), b = ri(1, 5), c = ri(1, 5);
      const unit = ri(3, 15);
      const total = (a + b + c) * unit;
      const want = pick([a, b, c]);
      return {
        text: `보물 ${total}개를 세 용사가 ${a} : ${b} : ${c} 로 나눠 가져요.\n${want}만큼 받는 용사는 몇 개를 가질까요?`,
        answer: want * unit,
        hint: `전체 묶음은 ${a} + ${b} + ${c} = ${a + b + c}개. 한 묶음 = ${total} ÷ ${a + b + c} = ${unit}.`,
      };
    },
  },
  {
    id: 'discountBack', min: 5, make: () => {
      const p = pick([10, 20, 25, 50]);
      const paid = pick([1800, 2400, 3000, 3600, 4500, 6000]);
      const price = (paid * 100) / (100 - p);
      if (!Number.isInteger(price)) {
        return {
          text: `정가 ${paid}원인 검을 ${p}% 할인하면 얼마일까요?`, answer: paid - (paid * p) / 100,
          hint: `할인 금액 = ${paid} × ${p} ÷ 100 = ${(paid * p) / 100}. 정가에서 빼요.`,
        };
      }
      return {
        text: `${p}% 할인해서 ${paid}원에 샀어요.\n할인하기 전 가격은 얼마일까요?`, answer: price,
        hint: `낸 돈은 원래 가격의 ${100 - p}% 예요. ${paid} ÷ ${100 - p} × 100 을 계산해요.`,
      };
    },
  },
];

const GENS = { 3: G3, 4: G4, 5: G5, 6: G6 };

/* ---------- 유형 뽑기 ----------
 * 난이도에 "방금 해금된" 유형을 크게 선호한다 → 난이도가 오른 게 문제 모양으로 느껴진다.
 * 같은 유형이 연달아 나오지 않게 직전 유형은 제외한다(지루함 방지). */
let lastId = '';
function choose(list, lv) {
  const avail = list.filter(t => t.min <= lv);
  const pool = avail.filter(t => t.id !== lastId);
  const use = pool.length ? pool : avail;
  const w = use.map(t => 1 / (1 + (lv - t.min) * 1.6));
  let total = 0;
  for (const v of w) total += v;
  let r = Math.random() * total;
  for (let i = 0; i < use.length; i++) {
    r -= w[i];
    if (r < 0) { lastId = use[i].id; return use[i]; }
  }
  lastId = use[use.length - 1].id;
  return use[use.length - 1];
}

export function gen(grade, lv = 1) {
  const g = GENS[grade] ? grade : 3;
  const L = Math.max(1, Math.min(5, Math.round(lv)));
  const t = choose(GENS[g], L);
  const p = t.make(L);
  return {
    text: p.text,
    answer: p.answer,
    hint: p.hint || digitHint(p.answer),
    lv: L,
    grade: g,
    type: t.id,
  };
}

export function check(input, answer) {
  const v = parseFloat(String(input).replace(/,/g, '').trim());
  if (Number.isNaN(v)) return false;
  return Math.abs(v - answer) < 0.001;
}
