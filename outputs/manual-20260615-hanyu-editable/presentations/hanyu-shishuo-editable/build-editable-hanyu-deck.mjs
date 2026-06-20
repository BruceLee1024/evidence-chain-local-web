import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
  createSlideContext,
  saveBlobToFile,
} from '/Users/bruce/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/scripts/artifact_tool_utils.mjs';

const workspace = '/Users/bruce/Desktop/证据链管理系统搭建/outputs/manual-20260615-hanyu-editable/presentations/hanyu-shishuo-editable';
const outputDir = '/Users/bruce/Desktop/证据链管理系统搭建/ppt/hanyu-shishuo-argument';
const finalPptx = path.join(outputDir, '跟着韩愈学吵架_师说议论文结构课_可编辑版.pptx');
const previewDir = path.join(workspace, 'preview-editable');
const qaDir = path.join(workspace, 'qa');

const W = 1280;
const H = 720;
const C = {
  ink: '#2a1e13',
  inkTint: '#3a2a1d',
  paper: '#eedfc7',
  paperTint: '#e0d0b6',
  darkText: '#f7ead4',
  darkMuted: '#bcae98',
  lightMuted: '#766855',
  ruleLight: '#8b7a63',
  ruleDark: '#c9bda7',
};

const fonts = {
  serif: 'Noto Serif SC',
  sans: 'Noto Sans SC',
  mono: 'IBM Plex Mono',
};

function cleanText(value) {
  return String(value ?? '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
}

const slides = [
  {
    kind: 'hero',
    theme: 'dark',
    chrome: 'Classroom Lecture · Argument Writing',
    page: '45 MIN · 01 / 26',
    kicker: '跟着韩愈学吵架',
    title: '从《师说》看\n满分议论文的黄金结构',
    lead: '不是背古文，而是拆一篇 1200 年前的高分议论文。',
    meta: '适用对象 · 高中生    ·    三段式结构 / 对比论证 / 结构性驳论',
    footLeft: 'Teacher Notes: PowerPoint 备注',
    footRight: 'Han Yu · Shi Shuo',
    notes: '同学们，今天这节课我们不把《师说》当作一篇需要硬背的古文，而把它当作一篇可以直接拿来模仿的议论文范文。\n\n我们的目标很明确：学会三段式结构，学会对比论证，更重要的是学会一种高手写议论文的习惯：先把反对者请进文章里，再把他一步步驳倒。',
  },
  {
    kind: 'hero',
    theme: 'light',
    chrome: 'Hook · 考场如战场',
    page: '02 / 26',
    kicker: '先把对手叫上场',
    title: '吃苦耐劳\n已经过时了吗？',
    lead: '如果有人说：现代社会拼的是选择、资源、运气，吃苦耐劳只是无效内卷。你打算怎么反驳？',
    footLeft: 'Opening Question',
    footRight: 'Debate Before Writing',
    notes: '先请大家想一个真实考场题：论吃苦耐劳是否已经过时。现在有一个人站在你面前，他说努力没用，苦干只是自我感动，关键是选择、资源和运气。\n\n你会怎么回答他？注意，这里不是让大家马上写观点，而是让大家意识到：议论文从来不是一个人在房间里自说自话，它本质上是一场辩论。',
  },
  {
    kind: 'cards',
    theme: 'light',
    chrome: 'Diagnosis · 常见病',
    page: '03 / 26',
    kicker: '很多作文输在这里',
    title: '议论文三大毛病',
    cards: [
      ['01', '开头磨叽', '铺垫太久，迟迟不亮观点。阅卷老师看了半天，还不知道你要证明什么。'],
      ['02', '中间打滚', '只会重复观点，论据像散沙，没有层次，也没有推进感。'],
      ['03', '结尾无力', '最后只是喊口号，没有完成回扣、升级和收束。'],
    ],
    callout: '更关键的问题是：很多文章只写“我要证明什么”，忘了写“别人会怎么反驳我”。',
    footLeft: 'Page 03 · Problem Diagnosis',
    footRight: 'Structure Matters',
    notes: '很多同学写议论文，会反复告诉阅卷老师“我的观点是对的”。但是为什么对？别人可能怎么质疑？质疑之后你怎么回应？这些都没有。\n\n所以文章就像在空气里挥拳，看起来很用力，实际上没有打到任何问题。今天我们要看的《师说》，厉害就厉害在每一拳都有靶子。',
  },
  {
    kind: 'split',
    theme: 'dark',
    chrome: 'Context · 韩愈的对手',
    page: '04 / 26',
    kicker: '1200 年前的现场',
    title: '耻学于师',
    lead: '当时士大夫阶层流行一种风气：向老师学习，尤其向年龄小、地位低的人学习，很丢脸。',
    callout: '韩愈不是温柔劝说，而是把这种风气当作错误观念，正面拆解、逐层驳斥。',
    sideTitle: '从师\n等于\n丢人？',
    sideBody: '韩愈要做的不是“解释老师很重要”，而是摧毁“向老师学习可耻”这套逻辑。',
    footLeft: 'Page 04 · Historical Opponent',
    footRight: 'Wrong Climate, Clear Target',
    notes: '韩愈写《师说》，面对的不是一个抽象题目，而是一种真实的社会风气。很多人觉得拜师学习丢身份，尤其是向比自己年轻、地位比自己低的人学习。\n\n所以韩愈的任务不是简单歌颂老师，而是要证明：只要有道理、有知识、有先闻之道的人，就可以成为老师。年龄、身份、贵贱都不是标准。',
  },
  {
    kind: 'table',
    theme: 'light',
    chrome: 'Structure · 全文总览',
    page: '05 / 26',
    kicker: '三段式议论文的标准答案',
    title: '立骨 · 析理 · 证例 · 收束',
    columns: ['结构', '《师说》段落', '核心任务', '写作启示'],
    rows: [
      ['引论', '第 1 段', '立骨：提出中心论点，下定义，亮标准', '开头要直接搭起判断标准'],
      ['本论', '第 2 段', '析理：用三组对比批驳错误现象', '主体要制造逻辑压力'],
      ['深化', '第 3 段', '证例：举圣人例子，进一步论证', '例子服务于驳论，不是装饰'],
      ['结论', '第 4 段', '收束：重申主张，交代写作缘由', '结尾完成回扣与落点'],
    ],
    lead: '韩愈像下棋一样，提前预判对手每一步，然后一次性布下全篇逻辑阵。',
    footLeft: 'Page 05 · Macro Structure',
    footRight: 'Argument Architecture',
    notes: '《师说》全文四段，几乎可以直接对应我们今天讲的议论文结构。第一段立论，第二段对比批驳，第三段举例深化，第四段收束说明。\n\n它不是想到哪里写到哪里，而是全篇都指向一个核心目标：驳倒“耻学于师”。这就是结构性论证。',
  },
  {
    kind: 'hero',
    theme: 'dark',
    chrome: 'Act I · Opening Paragraph',
    page: '06 / 26',
    kicker: '第一段精讲',
    title: '七句话\n七种立论技法',
    lead: '这一段最值得背的，不只是原文，而是每句话背后的写作功能。',
    footLeft: 'Act I · 立骨',
    footRight: 'Definition, Premise, Standard',
    notes: '接下来我们先看第一段。很多同学背《师说》第一段，只知道它很重要，但不知道它为什么重要。\n\n今天我们换一个角度：把每一句都当成作文开头的一步棋，看韩愈怎样在七句话里完成立论、定义、推理、驳疑和升华。',
  },
  {
    kind: 'strips',
    theme: 'light',
    chrome: 'Text · 第一段原文',
    page: '07 / 26',
    kicker: '先看原文的骨架',
    title: '每一句都在干活',
    strips: [
      ['01', '古之学者必有师。', '论点'],
      ['02', '师者，所以传道受业解惑也。', '定义'],
      ['03', '人非生而知之者，孰能无惑？', '前提'],
      ['04', '惑而不从师，其为惑也，终不解矣。', '后果'],
      ['05', '生乎吾前，其闻道也固先乎吾，吾从而师之；生乎吾后，其闻道也亦先乎吾，吾从而师之。', '标准'],
      ['06', '吾师道也，夫庸知其年之先后生于吾乎？', '驳疑'],
      ['07', '是故无贵无贱，无长无少，道之所存，师之所存也。', '升华'],
    ],
    footLeft: 'Page 07 · Seven Sentences',
    footRight: 'Every Sentence Has A Job',
    notes: '大家看，这七句话不是七句并列的古文，而是一条推进链。第一句直接亮观点，第二句定义老师，第三句建立人人都会有疑惑的普遍前提，第四句说明不从师的后果。\n\n第五句开始给标准：谁先懂道理，谁就可以做老师。第六句主动反驳年龄问题。第七句把结论升格为“道之所存，师之所存”。',
  },
  {
    kind: 'rubric',
    theme: 'dark',
    chrome: 'Method · 七句技法',
    page: '08 / 26',
    kicker: '可迁移的写法',
    title: '不是翻译，是拆功能',
    items: [
      ['01', '开头亮观点', '借“古之”“学者”带出权威感。'],
      ['02', '关键词定义', '先界定“师”，后面才有判断标准。'],
      ['03', '建立共识', '从人人承认的事实出发，降低阻力。'],
      ['04', '推出后果', '如果不从师，疑惑就永远不解。'],
      ['05', '验证标准', '前后两种场景，归到同一结论。'],
      ['06', '预判反对', '主动回应“年龄先后”的偏见。'],
      ['07', '总结升华', '从具体择师，上升到“道”的原则。'],
    ],
    callout: '一句论点二定义，三设前提四讲弊。五举场景六驳疑，七句升华收全意。',
    footLeft: 'Page 08 · Writing Techniques',
    footRight: 'Transferable Pattern',
    notes: '这就是我们真正要学的地方。作文不是句子越漂亮越好，而是每一句都要承担任务。韩愈第一段的强，是因为它没有废话。\n\n请大家记住这个口诀：一句论点二定义，三设前提四讲弊。五举场景六驳疑，七句升华收全意。以后写议论文开头，可以照这个骨架搭。',
  },
  {
    kind: 'pipeline',
    theme: 'light',
    chrome: 'Formula · 开头流水线',
    page: '09 / 26',
    kicker: '把古文变成考场动作',
    title: '七步写出一个硬开头',
    groups: [
      ['Opening Paragraph · 前四步先立住', [
        ['01', '亮观点', '先说你的判断，不绕路。'],
        ['02', '下定义', '把关键词说清，防止偷换概念。'],
        ['03', '设前提', '找一个大家承认的共同事实。'],
        ['04', '讲弊端', '说明不这样做会付出什么代价。'],
      ]],
      ['Opening Paragraph · 后三步完成封口', [
        ['05', '举场景', '用不同场景验证同一个标准。'],
        ['06', '驳偏见', '主动回应最常见的反对意见。'],
        ['07', '升华句', '把具体观点提升成通用原则。'],
      ]],
    ],
    footLeft: 'Page 09 · Opening Pipeline',
    footRight: 'Opening Pipeline',
    notes: '这一页我们把第一段直接改写成考场动作。写作时可以按顺序推进：亮观点，下定义，设前提，讲弊端，举场景，驳偏见，最后升华。\n\n请注意，真正有用的模板不是固定句式，而是功能顺序。句式可以变化，但功能最好不要缺。',
  },
  {
    kind: 'hero',
    theme: 'light',
    chrome: 'Act II · Body Paragraph',
    page: '10 / 26',
    kicker: '第二段精讲',
    title: '三组对比\n排山倒海',
    lead: '一组对比只能说明一点，三组递进对比才能形成逻辑压力。',
    footLeft: 'Act II · 析理',
    footRight: 'Contrast As Pressure',
    notes: '很多同学本论部分最容易没话说，写一组对比就停住。韩愈给我们的示范是：对比不只可以写一组，可以从时间、对象、身份三个维度连续推进。\n\n这样做的效果是，反对者不是被一个理由击中，而是被三面包围。',
  },
  {
    kind: 'cards',
    theme: 'light',
    chrome: 'Overview · 三组对比',
    page: '11 / 26',
    kicker: '三维打击',
    title: '从一个观点，扩成一张网',
    cards: [
      ['01', '纵向比', '古之圣人尚且从师，今之众人却耻学于师。结论：圣益圣，愚益愚。'],
      ['02', '横向比', '给孩子择师，却对自己耻师。结论：小学而大遗，未见其明。'],
      ['03', '阶层比', '百工不耻相师，士大夫群聚而笑。结论：其智反不能及。'],
    ],
    footLeft: 'Page 11 · Three Contrasts',
    footRight: 'Time, Object, Class',
    notes: '这三组对比一定要记住。第一组是纵向比：以前和现在。第二组是横向比：对孩子和对自己。第三组是阶层比：百工和士大夫。\n\n三个维度合起来，文章的主体就不再是单薄的一段话，而是一个立体的论证空间。',
  },
  {
    kind: 'compare',
    theme: 'dark',
    chrome: 'Contrast 01 · 古今对比',
    page: '12 / 26',
    kicker: '时间维度',
    title: '越优秀，越从师',
    left: ['古之圣人', '其出人也远矣，犹且从师而问焉', '圣人已经远超常人，却仍然保持求教姿态。'],
    right: ['今之众人', '其下圣人也亦远矣，而耻学于师', '普通人本来更需要学习，却反而以从师为耻。'],
    callout: '结论不是“圣人厉害”，而是：圣益圣，愚益愚。',
    footLeft: 'Page 12 · Vertical Contrast',
    footRight: 'Past vs Present',
    notes: '第一组对比非常狠。韩愈不是说普通人要学习，而是先说圣人都要学习。圣人已经很优秀了，还要从师；普通人远不如圣人，却耻于学习。\n\n这就形成了强烈反差：优秀的人继续进步，愚昧的人继续退步，所以“圣益圣，愚益愚”。',
  },
  {
    kind: 'compare',
    theme: 'light',
    chrome: 'Contrast 02 · 自身矛盾',
    page: '13 / 26',
    kicker: '对象维度',
    title: '对孩子严格，对自己宽松',
    left: ['爱其子', '择师而教之', '孩子不懂句读，家长知道要给他找老师。'],
    right: ['于其身', '则耻师焉', '自己有更大的疑惑，却觉得从师丢脸。'],
    callout: '韩愈抓住的是双重标准：小问题认真，大问题糊涂。',
    footLeft: 'Page 13 · Object Contrast',
    footRight: 'Child vs Self',
    notes: '第二组对比更贴身，它抓的是人的双重标准。我们愿意让孩子学习，因为孩子不会句读；但到了自己身上，明明有更大的困惑，却拒绝求教。\n\n韩愈说这叫“小学而大遗”，小的东西学了，大的东西丢了。这句话很适合用来批评那些只重形式、不重本质的现象。',
  },
  {
    kind: 'compare',
    theme: 'dark',
    chrome: 'Contrast 03 · 阶层对比',
    page: '14 / 26',
    kicker: '身份维度',
    title: '谁更像真正的学习者？',
    left: ['百工之人', '不耻相师', '职业地位被轻视，却能彼此学习、互相请教。'],
    right: ['士大夫之族', '群聚而笑之', '自以为高贵，却被身份焦虑困住。'],
    callout: '这一组对比的力度在于反转：自称君子者，智反不能及。',
    footLeft: 'Page 14 · Class Contrast',
    footRight: 'Workers vs Elites',
    notes: '第三组对比把问题推到社会身份层面。百工之人彼此学习，士大夫却嘲笑从师的人。韩愈用这个反差完成一次价值反转。\n\n表面上士大夫地位高，实际上他们的学习能力和认识水平，反而不如被他们看不起的人。这就是“其可怪也欤”的力量。',
  },
  {
    kind: 'table',
    theme: 'light',
    chrome: 'Tool · 三对矛盾',
    page: '15 / 26',
    kicker: '写不下去时，画一张表',
    title: '考场本论的续航方法',
    columns: ['比较方式', '怎么找', '写作效果'],
    rows: [
      ['纵向比', '以前 vs 现在', '拉出历史维度，证明问题不是偶然。'],
      ['横向比', '对别人 vs 对自己', '揭示双重标准，让对方难以自圆其说。'],
      ['阶层比', '被看低者 vs 自以为高者', '制造价值反转，形成讽刺和压力。'],
    ],
    lead: '一个观点，如果能找到三对矛盾，就能从“一句话”长成“一篇文章”。',
    footLeft: 'Page 15 · Body Paragraph Method',
    footRight: 'Three Contradictions',
    notes: '以后写议论文，如果本论部分没话说，不要硬凑名人名言。先画表，找三对矛盾：以前和现在，对别人和对自己，被看低的人和自以为高的人。\n\n这三种比法可以套到很多题目上。比如吃苦耐劳过时了吗，也可以从过去的苦干、今天的长期主义，对别人要求努力、对自己逃避努力，以及所谓“傻努力”和所谓“精明躺平”去比较。',
  },
  {
    kind: 'hero',
    theme: 'dark',
    chrome: 'Act III · Structural Rebuttal',
    page: '16 / 26',
    kicker: '核心亮点',
    title: '预设假想敌\n再逐条击破',
    lead: '好议论文不是只写“我赞成”，还要写“你可能反对，但你的反对站不住”。',
    footLeft: 'Act III · 驳论',
    footRight: 'Targeted Thinking',
    notes: '现在进入这节课最重要的部分：韩愈的靶向思维。什么叫靶向？就是他写文章之前，已经知道对方可能从哪里攻击他。\n\n他不是等别人反驳以后再补救，而是在文章结构里提前设靶，再一个一个打掉。这就是结构性驳论。',
  },
  {
    kind: 'opponents',
    theme: 'light',
    chrome: 'Opponent Map · 六个假想敌',
    page: '17 / 26',
    kicker: '把反对者请到现场',
    title: '韩愈预判了什么？',
    items: [
      ['拜年轻人为师丢人', '吾师道也，庸知其年。用“道”替代年龄。'],
      ['向地位低的人学失身份', '无贵无贱，道之所存。提前封堵身份论。'],
      ['成年人不需要专门拜师', '爱其子择师，于其身耻师。揭出双重标准。'],
      ['向底层人学习可耻', '百工之人不耻相师，智反不能及。完成反转。'],
      ['圣人不需要老师', '孔子师郯子、苌弘、师襄、老聃。借圣人反驳圣人崇拜。'],
      ['弟子不能超过老师', '弟子不必不如师，师不必贤于弟子。主动越界，重设关系。'],
    ],
    footLeft: 'Page 17 · Six Objections',
    footRight: 'Prebuttal Map',
    notes: '请大家看这六个假想敌。它们分别来自年龄焦虑、身份焦虑、自我宽纵、职业歧视、圣人崇拜和师徒关系误解。\n\n韩愈的文章厉害，是因为这些可能的反对意见都没有被放过。你想从年龄攻击，他说我学的是道；你想从身份攻击，他说无贵无贱；你想说圣人不用学，他直接举孔子为例。',
  },
  {
    kind: 'split',
    theme: 'dark',
    chrome: 'Root Cause · 看透病根',
    page: '18 / 26',
    kicker: '结构性驳论的前提',
    title: '先看透病根',
    lead: '“耻学于师”表面是一个态度，深层是六种心理：怕丢脸、怕降格、懒惰、双标、歧视、误解。',
    callout: '只有看清反对意见背后的原因，驳论才会刀刀见血，而不是隔靴搔痒。',
    sideTitle: '年龄焦虑\n身份焦虑\n双重标准\n职业歧视\n圣人崇拜\n师徒误解',
    sideBody: '先诊断问题，再设计论证。',
    footLeft: 'Page 18 · Root Causes',
    footRight: 'Diagnose Before Argue',
    notes: '结构性驳论不是简单列反对意见。更高级的一步，是看出反对意见背后的心理和利益。为什么他们不愿意从师？不是因为真的不需要，而是因为害怕丢脸，害怕降格，或者习惯性双标。\n\n这对我们的作文很重要。动笔前先问：为什么会有人反对我？他真正担心的是什么？当你看见病根，论证才会有穿透力。',
  },
  {
    kind: 'pipeline',
    theme: 'light',
    chrome: 'Exam Move · 考场操作',
    page: '19 / 26',
    kicker: '写作前 10 分钟',
    title: '先搭一张“反对者地图”',
    groups: [
      ['Pre-writing · 反驳准备', [
        ['01', '列反对句', '也许有人会说什么？先写 3 到 5 句。'],
        ['02', '找病根', '他怕什么？误解什么？偷换了什么？'],
        ['03', '分维度', '年龄、身份、利益、现实、价值。'],
        ['04', '排顺序', '从最容易接受的共识，推到最强结论。'],
        ['05', '写进文章', '用“也许有人认为……但事实上……”落笔。'],
      ]],
    ],
    callout: '不是怕别人反驳，而是怕你不知道别人会怎么反驳。',
    footLeft: 'Page 19 · Prebuttal Workflow',
    footRight: 'Prebuttal Workflow',
    notes: '考场上真正值得花时间的，不是马上写第一句，而是先花十分钟搭反对者地图。列出三到五句可能的反对意见，再问它们背后的病根是什么。\n\n然后把这些反对意见写进文章。比如“也许有人认为吃苦耐劳是无效内卷，但事实上，真正的问题不在于是否吃苦，而在于是否把苦吃在正确方向上。”这就是预辩。',
  },
  {
    kind: 'quote',
    theme: 'light',
    chrome: 'Parallel Text · 《六国论》',
    page: '20 / 26',
    kicker: '同样的高手动作',
    quote: '“或曰：六国互丧，\n率赂秦耶？”',
    lead: '苏洵也不等别人反驳，自己先设问，再自己回答。',
    footLeft: 'Page 20 · Liu Guo Lun',
    footRight: 'Question Before Answer',
    notes: '这种预设假想敌的手法，不只有韩愈会用。《六国论》开头说六国破灭，弊在赂秦。苏洵马上替读者提出质疑：六国都灭亡了，难道全都是因为贿赂秦国吗？\n\n然后他回答：不赂者以赂者丧。你看，这就是自己设问，自己回答。高手不怕问题，高手主动制造问题，然后控制问题的答案。',
  },
  {
    kind: 'pattern',
    theme: 'dark',
    chrome: 'Pattern · 预辩句式',
    page: '21 / 26',
    kicker: '从古文到作文',
    title: '把反对意见写成段落',
    pattern: '也许有人会认为……\n但事实上……',
    lead: '前半句请反对者上场，后半句重设问题的判断标准。',
    cards: [
      ['', '先承认', '承认对方看见了一部分现实。'],
      ['', '再区分', '指出他混淆了概念、对象或条件。'],
      ['', '后反转', '用更高标准收回论证主动权。'],
    ],
    footLeft: 'Page 21 · Transfer Pattern',
    footRight: 'Maybe, But',
    notes: '这是大家最容易迁移到作文里的句式：“也许有人会认为……但事实上……”。不要小看这句话，它的作用是把文章从单方面证明，变成有来有回的论辩。\n\n前半句让读者觉得你不是没看见现实，后半句则告诉读者：我看见了，但我比你看得更深。',
  },
  {
    kind: 'hero',
    theme: 'dark',
    chrome: 'Act IV · Practice',
    page: '22 / 26',
    kicker: '课后实战演练',
    title: '吃苦耐劳\n真的过时了吗？',
    lead: '仿照《师说》的开头结构、三组对比和预设反驳，写一篇议论文提纲。',
    footLeft: 'Act IV · Application',
    footRight: 'Write With An Opponent',
    notes: '现在我们把方法迁移到一个现代题目上：有人说现代社会竞争激烈，吃苦耐劳已经过时，拼的是选择、资源和运气。对此你怎么看？\n\n注意，今天的作业不是随便写感想，而是必须模仿《师说》的结构来写：开头七步，本论三组对比，再列出至少两个潜在反对意见。',
  },
  {
    kind: 'rubric',
    theme: 'light',
    chrome: 'Practice 01 · 开头模板',
    page: '23 / 26',
    kicker: '仿照第一段',
    title: '七步写开头',
    items: [
      ['01', '中心论点', '吃苦耐劳并未过时。'],
      ['02', '核心定义', '它不是盲目受苦，而是长期投入。'],
      ['03', '普遍前提', '任何选择都需要能力支撑。'],
      ['04', '反面后果', '不愿承担必要成本，机会也会落空。'],
      ['05', '择标标准', '苦要吃在方向、方法和复盘上。'],
      ['06', '反驳偏见', '反对无效内卷，不等于反对努力。'],
      ['07', '总结金句', '耐劳之所存，成长之所存。'],
    ],
    footLeft: 'Page 23 · Opening Exercise',
    footRight: 'Seven Slots',
    notes: '这页是开头的七个槽位。大家写的时候，不要求句子完全一样，但要保证功能完整。比如定义“吃苦耐劳”时，一定要把它和盲目吃苦区分开。\n\n否则你会被对方一句“无效内卷”带走。我们要说的是：吃苦耐劳不是无脑消耗，而是在正确方向上持续投入、复盘和承担成本。',
  },
  {
    kind: 'cards',
    theme: 'dark',
    chrome: 'Practice 02 · 本论提纲',
    page: '24 / 26',
    kicker: '仿照三组对比',
    title: '把观点写成立体论证',
    cards: [
      ['01', '过去 vs 现在', '过去需要体力耐劳，今天更需要认知耐劳、情绪耐劳和长期复盘。'],
      ['02', '对别人 vs 对自己', '我们赞赏他人的长期坚持，却常把自己的逃避包装成“看透内卷”。'],
      ['03', '“傻”人 vs “精”人', '真正精明的人不是拒绝吃苦，而是选择值得吃的苦，并让每次投入产生积累。'],
    ],
    footLeft: 'Page 24 · Body Outline',
    footRight: 'Three Contrasts Applied',
    notes: '本论部分就按三组对比来搭。第一组，过去和现在。注意不要把过去写成简单体力劳动，也不要把现在写成完全不需要努力。今天需要的是更复杂的耐劳。\n\n第二组，对别人和对自己，抓双标。第三组，把所谓“傻努力”的人和所谓“精明躺平”的人对比，完成价值反转。',
  },
  {
    kind: 'twocards',
    theme: 'light',
    chrome: 'Practice 03 · 预设反驳',
    page: '25 / 26',
    kicker: '仿照结构性驳论',
    title: '至少列出两个假想敌',
    cards: [
      ['Opponent 01', '“苦干只会被剥削”', '反驳思路：批判剥削不等于否定努力。真正要反对的是没有方向、没有权益、没有成长的消耗。'],
      ['Opponent 02', '“选择比努力重要”', '反驳思路：选择当然重要，但选择能力本身来自长期学习、观察、试错和复盘。'],
    ],
    callout: '你越能替反对者把话说清楚，你的反驳就越有力量。',
    footLeft: 'Page 25 · Rebuttal Exercise',
    footRight: 'Opponent Sentences',
    notes: '最后一步，是列出至少两个潜在反对意见。这里有两个常见例子：第一，苦干会被剥削；第二，选择比努力重要。\n\n我们的反驳不能粗暴。要先承认对方说中了一部分现实，然后指出他的结论过度了。批判剥削不等于否定努力，强调选择也不等于否定长期能力的积累。',
  },
  {
    kind: 'quote',
    theme: 'dark',
    chrome: 'Closing · Takeaway',
    page: '26 / 26',
    kicker: '最后记住一句话',
    quote: '好文章不是写出来的，\n是辩出来的。',
    lead: '不怕别人骂，就怕没人骂。把反对意见写进文章，你的论证才真正开始发力。',
    footLeft: 'End · Debate Before Writing',
    footRight: 'Han Yu Method',
    notes: '同学们，今天这节课的最后一句话是：好文章不是写出来的，是辩出来的。写作前，先把问题想透，把反对意见想透，把对方的退路想透。\n\n当你能像韩愈一样预判对手的招数，再一张一弛、步步为营地下笔，你的议论文就会从自说自话，变成真正有说服力的论证。',
  },
];

function theme(slide) {
  return slide.theme === 'dark'
    ? { bg: C.ink, fg: C.darkText, muted: C.darkMuted, rule: C.ruleDark, fill: '#3a2a1d' }
    : { bg: C.paper, fg: C.ink, muted: C.lightMuted, rule: C.ruleLight, fill: C.paperTint };
}

function setBackground(slide, t) {
  slide.background.fill = t.bg;
}

function addText(ctx, slide, opts) {
  const {
    text,
    left,
    top,
    width,
    height,
    size = 24,
    color,
    bold = false,
    face = fonts.sans,
    align = 'left',
    valign = 'top',
    opacity,
  } = opts;
  const shape = ctx.addText(slide, {
    left, top, width, height,
    text: cleanText(text),
    fontSize: size,
    color,
    bold,
    face,
    align,
    valign,
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
  });
  if (opacity !== undefined) shape.opacity = opacity;
  return shape;
}

function addRect(ctx, slide, opts) {
  return ctx.addShape(slide, {
    geometry: 'rect',
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    fill: opts.fill ?? '#00000000',
    line: { style: 'solid', fill: opts.line ?? '#00000000', width: opts.lineWidth ?? 0 },
  });
}

function addLine(ctx, slide, x, y, w, color, height = 1) {
  addRect(ctx, slide, { left: x, top: y, width: w, height, fill: color, line: color, lineWidth: 0 });
}

function addChrome(ctx, slide, data, t, index) {
  addText(ctx, slide, { text: data.chrome, left: 77, top: 47, width: 650, height: 18, size: 11, color: t.muted, face: fonts.mono });
  addText(ctx, slide, { text: data.page, left: 1005, top: 47, width: 200, height: 18, size: 11, color: t.muted, face: fonts.mono, align: 'right' });
  addText(ctx, slide, { text: data.footLeft ?? `Page ${String(index + 1).padStart(2, '0')}`, left: 77, top: 638, width: 620, height: 20, size: 10, color: t.muted, face: fonts.mono });
  addText(ctx, slide, { text: data.footRight ?? '', left: 730, top: 638, width: 470, height: 20, size: 10, color: t.muted, face: fonts.mono, align: 'right' });
  const dots = slides.length;
  const startX = 392;
  for (let i = 0; i < dots; i += 1) {
    addRect(ctx, slide, {
      left: startX + i * 18,
      top: 688,
      width: i === index ? 22 : 8,
      height: 8,
      fill: i === index ? t.fg : t.muted,
      line: '#00000000',
    });
  }
}

function addTitleBlock(ctx, slide, data, t, y = 92, titleSize = 64) {
  addText(ctx, slide, { text: data.kicker, left: 78, top: y, width: 760, height: 28, size: 15, color: t.muted, bold: true, face: fonts.sans });
  addText(ctx, slide, { text: data.title, left: 78, top: y + 40, width: 930, height: 145, size: titleSize, color: t.fg, bold: true, face: fonts.serif });
}

function renderHero(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addText(ctx, slide, { text: data.kicker, left: 78, top: 176, width: 760, height: 26, size: 15, color: t.muted, bold: true, face: fonts.sans });
  addText(ctx, slide, { text: data.title, left: 78, top: 244, width: 980, height: 180, size: data.title.length > 16 ? 58 : 68, color: t.fg, bold: true, face: fonts.serif });
  if (data.lead) addText(ctx, slide, { text: data.lead, left: 78, top: 470, width: 830, height: 70, size: 24, color: t.fg, face: fonts.serif });
  if (data.meta) addText(ctx, slide, { text: data.meta, left: 78, top: 505, width: 920, height: 24, size: 13, color: t.muted, face: fonts.mono });
}

function renderCards(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 92, 62);
  const top = 304;
  const cardW = 350;
  data.cards.forEach((card, i) => {
    const x = 78 + i * 390;
    addLine(ctx, slide, x, top, cardW, t.rule, 1);
    addText(ctx, slide, { text: card[0], left: x, top: top + 20, width: 70, height: 28, size: 24, color: t.muted, face: fonts.serif });
    addText(ctx, slide, { text: card[1], left: x, top: top + 62, width: cardW, height: 42, size: 26, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: card[2], left: x, top: top + 114, width: cardW, height: 115, size: 17, color: t.fg, face: fonts.sans });
  });
  if (data.callout) {
    addRect(ctx, slide, { left: 78, top: 560, width: 830, height: 58, fill: data.theme === 'dark' ? '#ffffff10' : '#0000000d', line: '#00000000' });
    addText(ctx, slide, { text: data.callout, left: 102, top: 574, width: 790, height: 34, size: 19, color: t.fg, face: fonts.serif });
  }
}

function renderSplit(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addText(ctx, slide, { text: data.kicker, left: 78, top: 108, width: 580, height: 28, size: 15, color: t.muted, bold: true, face: fonts.sans });
  addText(ctx, slide, { text: data.title, left: 78, top: 158, width: 560, height: 100, size: 64, color: t.fg, bold: true, face: fonts.serif });
  addText(ctx, slide, { text: data.lead, left: 78, top: 285, width: 620, height: 110, size: 24, color: t.fg, face: fonts.serif });
  addRect(ctx, slide, { left: 78, top: 486, width: 620, height: 92, fill: data.theme === 'dark' ? '#ffffff10' : '#0000000d', line: '#00000000' });
  addText(ctx, slide, { text: data.callout, left: 102, top: 504, width: 570, height: 58, size: 19, color: t.fg, face: fonts.serif });
  addRect(ctx, slide, { left: 790, top: 150, width: 360, height: 370, fill: data.theme === 'dark' ? '#ffffff0d' : '#0000000d', line: t.rule, lineWidth: 1 });
  addText(ctx, slide, { text: data.sideTitle, left: 822, top: 190, width: 290, height: 220, size: data.sideTitle.length > 20 ? 30 : 50, color: t.fg, bold: true, face: fonts.serif });
  addText(ctx, slide, { text: data.sideBody, left: 822, top: 432, width: 285, height: 70, size: 17, color: t.fg, face: fonts.sans });
}

function renderTable(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 90, 58);
  const x = 78;
  const y = 285;
  const w = 1120;
  const colCount = data.columns.length;
  const colW = w / colCount;
  const rowH = data.rows.length > 3 ? 58 : 70;
  addLine(ctx, slide, x, y, w, t.rule);
  data.columns.forEach((c, i) => addText(ctx, slide, { text: c, left: x + i * colW + 8, top: y + 14, width: colW - 16, height: 26, size: 12, color: t.muted, bold: true, face: fonts.mono }));
  data.rows.forEach((row, r) => {
    const yy = y + 50 + r * rowH;
    addLine(ctx, slide, x, yy, w, t.rule);
    row.forEach((cell, c) => addText(ctx, slide, { text: cell, left: x + c * colW + 8, top: yy + 12, width: colW - 16, height: rowH - 14, size: c === 0 ? 20 : 16, color: t.fg, bold: c === 0, face: c === 0 ? fonts.serif : fonts.sans }));
  });
  if (data.lead) addText(ctx, slide, { text: data.lead, left: 78, top: 555, width: 930, height: 56, size: 24, color: t.fg, face: fonts.serif });
}

function renderStrips(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 78, 54);
  const startY = 255;
  data.strips.forEach((s, i) => {
    const y = startY + i * 47;
    addLine(ctx, slide, 78, y, 1120, t.rule);
    addText(ctx, slide, { text: s[0], left: 78, top: y + 11, width: 60, height: 28, size: 24, color: t.muted, face: fonts.serif });
    addText(ctx, slide, { text: s[1], left: 150, top: y + 9, width: 820, height: 36, size: i === 4 ? 15 : 18, color: t.fg, face: fonts.serif });
    addText(ctx, slide, { text: s[2], left: 1040, top: y + 13, width: 140, height: 22, size: 12, color: t.muted, face: fonts.mono });
  });
}

function renderRubric(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 82, 54);
  const x0 = 78;
  const y = 265;
  const w = 1120 / 7;
  data.items.forEach((it, i) => {
    const x = x0 + i * w;
    addLine(ctx, slide, x, y, w - 12, t.rule);
    addText(ctx, slide, { text: it[0], left: x, top: y + 16, width: 60, height: 24, size: 20, color: t.muted, face: fonts.serif });
    addText(ctx, slide, { text: it[1], left: x, top: y + 52, width: w - 18, height: 42, size: 16, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: it[2], left: x, top: y + 104, width: w - 18, height: 86, size: 12.5, color: t.fg, face: fonts.sans });
  });
  if (data.callout) {
    addRect(ctx, slide, { left: 78, top: 555, width: 960, height: 56, fill: data.theme === 'dark' ? '#ffffff10' : '#0000000d', line: '#00000000' });
    addText(ctx, slide, { text: data.callout, left: 100, top: 570, width: 910, height: 32, size: 20, color: t.fg, face: fonts.serif });
  }
}

function renderPipeline(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 82, 58);
  let y = 250;
  data.groups.forEach((group) => {
    addLine(ctx, slide, 78, y, 1120, t.rule);
    addText(ctx, slide, { text: group[0], left: 78, top: y + 22, width: 680, height: 20, size: 12, color: t.muted, face: fonts.mono });
    const steps = group[1];
    const gap = 16;
    const cardW = (1120 - gap * (steps.length - 1)) / steps.length;
    steps.forEach((step, i) => {
      const x = 78 + i * (cardW + gap);
      addLine(ctx, slide, x, y + 62, cardW, t.rule);
      addText(ctx, slide, { text: step[0], left: x, top: y + 80, width: 50, height: 20, size: 14, color: t.muted, face: fonts.serif });
      addText(ctx, slide, { text: step[1], left: x, top: y + 110, width: cardW, height: 28, size: 21, color: t.fg, bold: true, face: fonts.serif });
      addText(ctx, slide, { text: step[2], left: x, top: y + 146, width: cardW, height: 50, size: 13.5, color: t.fg, face: fonts.sans });
    });
    y += 220;
  });
  if (data.callout) addText(ctx, slide, { text: data.callout, left: 78, top: 555, width: 850, height: 40, size: 22, color: t.fg, face: fonts.serif });
}

function renderCompare(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 82, 56);
  const boxes = [data.left, data.right];
  boxes.forEach((box, i) => {
    const x = 92 + i * 575;
    addLine(ctx, slide, x, 300, 470, t.rule, 3);
    addText(ctx, slide, { text: box[0], left: x, top: 330, width: 470, height: 24, size: 14, color: t.muted, face: fonts.mono });
    addText(ctx, slide, { text: box[1], left: x, top: 376, width: 470, height: 76, size: 28, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: box[2], left: x, top: 468, width: 470, height: 70, size: 18, color: t.fg, face: fonts.sans });
  });
  addRect(ctx, slide, { left: 78, top: 570, width: 850, height: 44, fill: data.theme === 'dark' ? '#ffffff10' : '#0000000d', line: '#00000000' });
  addText(ctx, slide, { text: data.callout, left: 98, top: 582, width: 815, height: 24, size: 19, color: t.fg, face: fonts.serif });
}

function renderOpponents(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 82, 58);
  const cardW = 360;
  const cardH = 108;
  data.items.forEach((it, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 78 + col * 383;
    const y = 285 + row * 128;
    addLine(ctx, slide, x, y, cardW, t.rule, 2);
    addText(ctx, slide, { text: it[0], left: x, top: y + 18, width: cardW, height: 30, size: 19, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: it[1], left: x, top: y + 55, width: cardW, height: 56, size: 15, color: t.fg, face: fonts.sans });
  });
}

function renderQuote(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addText(ctx, slide, { text: data.kicker, left: 78, top: 190, width: 760, height: 28, size: 15, color: t.muted, bold: true, face: fonts.sans });
  addText(ctx, slide, { text: data.quote, left: 78, top: 265, width: 950, height: 165, size: data.quote.length > 25 ? 56 : 62, color: t.fg, bold: true, face: fonts.serif });
  addText(ctx, slide, { text: data.lead, left: 78, top: 470, width: 900, height: 56, size: 23, color: t.fg, face: fonts.serif });
}

function renderPattern(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 86, 56);
  addRect(ctx, slide, { left: 78, top: 280, width: 680, height: 165, fill: '#ffffff10', line: t.rule, lineWidth: 1 });
  addText(ctx, slide, { text: data.pattern, left: 110, top: 316, width: 620, height: 82, size: 38, color: t.fg, bold: true, face: fonts.serif });
  addText(ctx, slide, { text: data.lead, left: 110, top: 410, width: 590, height: 32, size: 18, color: t.fg, face: fonts.sans });
  data.cards.forEach((card, i) => {
    const x = 78 + i * 383;
    addLine(ctx, slide, x, 490, 340, t.rule);
    addText(ctx, slide, { text: card[1], left: x, top: 516, width: 340, height: 32, size: 24, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: card[2], left: x, top: 555, width: 340, height: 45, size: 15, color: t.fg, face: fonts.sans });
  });
}

function renderTwoCards(ctx, slide, data, t, index) {
  addChrome(ctx, slide, data, t, index);
  addTitleBlock(ctx, slide, data, t, 82, 56);
  data.cards.forEach((card, i) => {
    const x = 90 + i * 570;
    addLine(ctx, slide, x, 305, 500, t.rule, 2);
    addText(ctx, slide, { text: card[0], left: x, top: 330, width: 260, height: 24, size: 13, color: t.muted, face: fonts.mono });
    addText(ctx, slide, { text: card[1], left: x, top: 372, width: 480, height: 42, size: 28, color: t.fg, bold: true, face: fonts.serif });
    addText(ctx, slide, { text: card[2], left: x, top: 435, width: 480, height: 115, size: 18, color: t.fg, face: fonts.sans });
  });
  addRect(ctx, slide, { left: 78, top: 580, width: 720, height: 44, fill: '#0000000d', line: '#00000000' });
  addText(ctx, slide, { text: data.callout, left: 100, top: 592, width: 680, height: 24, size: 19, color: t.fg, face: fonts.serif });
}

function renderSlide(ctx, presentation, data, index) {
  const slide = presentation.slides.add();
  const t = theme(data);
  setBackground(slide, t);
  if (slide.speakerNotes && data.notes) slide.speakerNotes.setText(data.notes);
  switch (data.kind) {
    case 'hero': renderHero(ctx, slide, data, t, index); break;
    case 'cards': renderCards(ctx, slide, data, t, index); break;
    case 'split': renderSplit(ctx, slide, data, t, index); break;
    case 'table': renderTable(ctx, slide, data, t, index); break;
    case 'strips': renderStrips(ctx, slide, data, t, index); break;
    case 'rubric': renderRubric(ctx, slide, data, t, index); break;
    case 'pipeline': renderPipeline(ctx, slide, data, t, index); break;
    case 'compare': renderCompare(ctx, slide, data, t, index); break;
    case 'opponents': renderOpponents(ctx, slide, data, t, index); break;
    case 'quote': renderQuote(ctx, slide, data, t, index); break;
    case 'pattern': renderPattern(ctx, slide, data, t, index); break;
    case 'twocards': renderTwoCards(ctx, slide, data, t, index); break;
    default: throw new Error(`Unknown slide kind: ${data.kind}`);
  }
  return slide;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });
  await ensureArtifactToolWorkspace(workspace);
  const artifact = await importArtifactTool(workspace);
  const { Presentation, PresentationFile } = artifact;
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const ctx = createSlideContext(artifact, {
    slideSize: { width: W, height: H },
    workspaceDir: workspace,
    titleFont: fonts.serif,
    bodyFont: fonts.sans,
    monoFont: fonts.mono,
  });

  const slideObjs = slides.map((data, index) => renderSlide(ctx, presentation, data, index));
  const previewPaths = [];
  for (let i = 0; i < slideObjs.length; i += 1) {
    const blob = await presentation.export({ slide: slideObjs[i], format: 'png', scale: 1 });
    const previewPath = path.join(previewDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await saveBlobToFile(blob, previewPath);
    previewPaths.push(previewPath);
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  const stat = await fs.stat(finalPptx);
  await fs.writeFile(path.join(workspace, 'editable-build-manifest.json'), JSON.stringify({
    output: finalPptx,
    outputBytes: stat.size,
    slideCount: presentation.slides.count,
    previewDir,
    previewPaths,
    editability: 'Native PowerPoint text boxes, rules, rectangles, and speaker notes. No full-slide screenshots.',
  }, null, 2));
  await fs.writeFile(path.join(qaDir, 'conversion-notes.txt'), [
    'Task mode: HTML-to-editable-PPT conversion',
    'Profile: targeted editable conversion',
    'Source caveat: original index.html was missing from disk during conversion; content was reconstructed from the generated 26-slide deck text in the current session.',
    'Fidelity choice: editable PPT objects over pixel-perfect raster screenshots.',
    'Preserved: visible Chinese lesson content, page rhythm, light/dark kraft-paper palette, cards, tables, comparison layouts, and speaker notes.',
    'Not preserved: WebGL background, browser keyboard navigation, ESC index, B low-power mode, and step-by-step web animations.',
  ].join('\n') + '\n');
  console.log(JSON.stringify({ output: finalPptx, bytes: stat.size, slides: presentation.slides.count, previewDir }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
