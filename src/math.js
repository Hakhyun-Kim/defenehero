/* =====================================================
 * 수학 문제 생성기 (3학년 ~ 6학년)
 * gen(grade) -> { text, answer, kp, gold, hint }
 *  - hint: 풀이 전략 + 정답 첫 숫자. 보면 지식(희귀도)이 깎인다.
 * ===================================================== */
const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[ri(0, arr.length - 1)];

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
  if (Math.random() < 0.4) return wordWrap(op, a, b, ans);
  return { text: plain, answer: ans, hint: plainHint };
}

/* ---------- 3학년 ---------- */
function g3() {
  const t = ri(1, 4);
  if (t === 1) {
    const a = ri(123, 867), b = ri(102, 999 - a);
    return maybeWord('add', a, b, a + b, `${a} + ${b} = ?`,
      `일의 자리부터 차례대로 더해요. 받아올림 조심! ${digitHint(a + b)}`);
  }
  if (t === 2) {
    const a = ri(310, 985), b = ri(102, a - 105);
    return maybeWord('sub', a, b, a - b, `${a} − ${b} = ?`,
      `일의 자리부터 빼요. 모자라면 윗자리에서 10을 빌려와요! ${digitHint(a - b)}`);
  }
  if (t === 3) {
    const a = ri(12, 89), b = ri(2, 9);
    return maybeWord('mul', a, b, a * b, `${a} × ${b} = ?`,
      `${a}를 ${Math.floor(a / 10) * 10} + ${a % 10}으로 나눠서 각각 ${b}를 곱한 뒤 더해요. ${digitHint(a * b)}`);
  }
  const b = ri(2, 9);
  const q = ri(3, Math.floor(98 / b));
  const a = b * q;
  return maybeWord('div', a, b, q, `${a} ÷ ${b} = ?`,
    `구구단 ${b}단을 떠올려요! ${b} × 몇 = ${a} 일까요?`);
}

/* ---------- 4학년 ---------- */
function g4() {
  const t = ri(1, 4);
  if (t === 1) {
    const a = ri(12, 48), b = ri(12, 29);
    return maybeWord('mul', a, b, a * b, `${a} × ${b} = ?`,
      `${a} × ${b} = ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} 으로 나눠 계산해요. ${digitHint(a * b)}`);
  }
  if (t === 2) {
    const a = ri(112, 489), b = ri(3, 9);
    return {
      text: `${a} × ${b} = ?`, answer: a * b,
      hint: `일의 자리부터 곱하고 받아올림을 더해요. ${digitHint(a * b)}`,
    };
  }
  if (t === 3) {
    const b = ri(12, 25), q = ri(3, 9);
    return maybeWord('div', b * q, b, q, `${b * q} ÷ ${b} = ?`,
      `${b} × 몇 = ${b * q} 일까요? ${b}씩 몇 번 묶을 수 있는지 세어 봐요.`);
  }
  if (Math.random() < 0.5) {
    const a = ri(1250, 7800), b = ri(1020, 9999 - a);
    return {
      text: `${a} + ${b} = ?`, answer: a + b,
      hint: `천의 자리까지 자리를 맞춰 더해요. ${digitHint(a + b)}`,
    };
  }
  const a = ri(3200, 9850), b = ri(1120, a - 1050);
  return {
    text: `${a} − ${b} = ?`, answer: a - b,
    hint: `자리를 맞춰 일의 자리부터 빼요. ${digitHint(a - b)}`,
  };
}

/* ---------- 5학년 ---------- */
function g5() {
  const t = ri(1, 4);
  if (t === 1) {
    const f = ri(1, 3);
    if (f === 1) {
      const b = ri(3, 9), c = ri(3, 9), a = ri(10, 90);
      return {
        text: `${a} + ${b} × ${c} = ?`, answer: a + b * c,
        hint: `곱셈을 먼저! ${b} × ${c}를 계산한 다음 ${a}를 더해요.`,
      };
    }
    if (f === 2) {
      const b = ri(3, 9), c = ri(3, 9), a = b * c + ri(5, 40);
      return {
        text: `${a} − ${b} × ${c} = ?`, answer: a - b * c,
        hint: `곱셈을 먼저! ${b} × ${c}를 계산한 다음 ${a}에서 빼요.`,
      };
    }
    const a = ri(5, 25), b = ri(5, 25), c = ri(3, 8);
    return {
      text: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c,
      hint: `괄호 안을 먼저! ${a} + ${b}를 구한 다음 ${c}를 곱해요.`,
    };
  }
  if (t === 2) {
    const A = ri(105, 899), B = ri(101, 880);
    if (Math.random() < 0.5) {
      return {
        text: `${A / 100} + ${B / 100} = ?`, answer: (A + B) / 100,
        hint: `소수점 자리를 맞춰 세로로 더해요. ${digitHint((A + B) / 100)}`,
      };
    }
    const big = Math.max(A, B), small = Math.min(A, B) - 1;
    return {
      text: `${big / 100} − ${small / 100} = ?`, answer: (big - small) / 100,
      hint: `소수점 자리를 맞춰 세로로 빼요. ${digitHint((big - small) / 100)}`,
    };
  }
  if (t === 3) {
    const A = ri(11, 89), b = ri(3, 9);
    return {
      text: `${A / 10} × ${b} = ?`, answer: (A * b) / 10,
      hint: `먼저 ${A} × ${b}를 계산하고, 소수점을 한 칸 찍어요.`,
    };
  }
  const m = ri(12, 60);
  const d1 = ri(-8, 8), d2 = ri(-8, 8), d3 = ri(-8, 8);
  const nums = [m + d1, m + d2, m + d3, m - d1 - d2 - d3];
  return {
    text: `네 수 ${nums.join(', ')}의 평균은 얼마일까요?`, answer: m,
    hint: `평균 = (네 수를 모두 더한 값) ÷ 4. 먼저 다 더해 보세요!`,
  };
}

/* ---------- 6학년 ---------- */
function g6() {
  const t = ri(1, 4);
  if (t === 1) {
    const a = ri(1, 4), k = ri(2, 4);
    const num = a * k;
    const b = ri(num + 1, num + 6);
    return {
      text: `${num}/${b} ÷ ${a}/${b} = ?`, answer: k,
      hint: `분모가 같은 분수의 나눗셈은 분자끼리! ${num} ÷ ${a}를 계산해요.`,
    };
  }
  if (t === 2) {
    const d = ri(2, 9), q = ri(3, 14);
    const dividend = (d * q) / 10;
    return {
      text: `${dividend} ÷ ${d / 10} = ?`, answer: q,
      hint: `둘 다 10배 해서 소수점을 없애요: ${dividend * 10} ÷ ${d} 와 같아요.`,
    };
  }
  if (t === 3) {
    const bases = [20, 40, 60, 80, 120, 160, 200, 240, 300];
    const ps = [5, 10, 15, 20, 25, 50, 75];
    let b, p;
    do { b = pick(bases); p = pick(ps); } while ((b * p) % 100 !== 0);
    return {
      text: `${b}의 ${p}%는 얼마일까요?`, answer: (b * p) / 100,
      hint: `${p}%는 ${p}/100이에요. ${b} × ${p} ÷ 100을 계산해요.`,
    };
  }
  const bases = [20, 25, 40, 50, 80, 100, 200];
  const ps = [10, 20, 25, 30, 40, 50, 60, 75, 80];
  let b, p;
  do { b = pick(bases); p = pick(ps); } while ((b * p) % 100 !== 0);
  const x = (b * p) / 100;
  return {
    text: `${x}은(는) ${b}의 몇 %일까요?\n(숫자만 쓰세요)`, answer: p,
    hint: `${x} ÷ ${b} × 100을 계산하면 몇 %인지 나와요.`,
  };
}

const GENS = { 3: g3, 4: g4, 5: g5, 6: g6 };

export function gen(grade) {
  const g = GENS[grade] ? grade : 3;
  const p = GENS[g]();
  return {
    text: p.text,
    answer: p.answer,
    hint: p.hint || digitHint(p.answer),
    kp: g - 2,
    gold: g * 8,
  };
}

export function check(input, answer) {
  const v = parseFloat(String(input).replace(/,/g, '').trim());
  if (Number.isNaN(v)) return false;
  return Math.abs(v - answer) < 0.001;
}
