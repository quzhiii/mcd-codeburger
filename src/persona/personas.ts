import type { Persona, PersonaId } from './types.ts';

/**
 * 8 个汉堡角色。
 *
 * 设计约束：
 * - **全部保持汉堡形态**。不出现薯条、可乐、甜筒、鸡块、咖啡等非汉堡形态。
 * - 差异**只**来自五个轴：面包 / 夹层 / 装饰 / 服装 / 表情。
 * - 命名规则：`[性格特征词] + [标志性食材] + 堡`。
 * - 全部是原创虚拟角色，**不是**任何真实餐品，**不是**麦当劳官方角色。
 */
export const PERSONAS: Persona[] = [
  {
    id: 'chili-social',
    name: '社牛辣椒堡',
    keyword: '外向、热情、能量拉满',
    tagline: '我认识的人比你刷的视频还多。',
    vec: [1, 0, 0, -1, 1],
    agentEffect: 'inspiration',
    visual: {
      bun: '红椒粉亮面，芝麻密集',
      filling: '双层辣鸡腿，辣酱从边缘溢出',
      prop: '头顶小喇叭 + 应援棒',
      outfit: '亮片运动外套',
      expression: '张嘴大笑，脸颊泛红',
      color: '#e23b26',
      bunShape: 'classic-dome',
    },
  },
  {
    id: 'night-slack',
    name: '深夜摸鱼堡',
    keyword: '白天关机、夜里才活过来',
    tagline: '别问我白天在干嘛，我没醒。',
    vec: [-1, -1, 0, 1, 0],
    agentEffect: 'slack',
    visual: {
      bun: '深棕软包，微微压扁',
      filling: '单层肉饼 + 少量生菜，料最少',
      prop: '月亮挂件 + 小枕头',
      outfit: '宽松睡衣 + 睡帽',
      expression: '半睁眼，正在打哈欠',
      color: '#6b4a32',
      bunShape: 'squashed',
    },
  },
  {
    id: 'cheese-spark',
    name: '灵感芝士堡',
    keyword: '好奇心重、点子跳脱',
    tagline: '刚又想出三个主意，一个都没记住。',
    vec: [0, 0, 1, 0, 1],
    agentEffect: 'inspiration',
    visual: {
      bun: '金黄奶香包，表面鼓起',
      filling: '芝士拉丝拉出体外',
      prop: '灯泡 + 星星碎片',
      outfit: '画家围裙，沾着颜料',
      expression: '眼睛发光，嘴张开',
      color: '#f7b92b',
      bunShape: 'puffy',
    },
  },
  {
    id: 'calm-double',
    name: '淡定双层堡',
    keyword: '稳、慢、不慌',
    tagline: '急也没用，反正都要排队。',
    vec: [0, 1, -1, 1, -1],
    agentEffect: 'focus',
    visual: {
      bun: '素色平整，形状最规整',
      filling: '双层牛肉，层层对齐',
      prop: '茶杯 + 云朵气泡',
      outfit: '针织开衫',
      expression: '眯眼微笑',
      color: '#e8dfd2',
      bunShape: 'flat-square',
    },
  },
  {
    id: 'plan-drumstick',
    name: '计划鸡腿堡',
    keyword: '有条理、目标感强',
    tagline: '我的待办事项有编号，还有优先级。',
    vec: [-1, 1, 0, -1, -1],
    agentEffect: 'focus',
    visual: {
      bun: '干脆的方形包，棱角分明',
      filling: '鸡腿排 + 定量生菜，比例精确',
      prop: '小旗子 + 进度条',
      outfit: '工装背心，口袋很多',
      expression: '认真抿嘴',
      color: '#35618f',
      bunShape: 'flat-square',
    },
  },
  {
    id: 'risky-cod',
    name: '冒险鳕鱼堡',
    keyword: '敢试、不怕翻车',
    tagline: '没吃过的东西才值得点。',
    vec: [0, -1, 1, 0, 1],
    agentEffect: 'bug',
    visual: {
      bun: '不规则手作包，微微歪斜',
      filling: '鳕鱼排 + 冒险酱，摆得随意',
      prop: '指南针 + 小地图',
      outfit: '冲锋衣',
      expression: '眼睛瞪圆，兴奋',
      color: '#16a79b',
      bunShape: 'wonky',
    },
  },
  {
    id: 'shaky-hashbrown',
    name: '手抖薯饼堡',
    keyword: '冲动、手快、小错不断',
    tagline: '我不是故意的，但确实掉了。',
    vec: [1, -1, 0, -1, 1],
    agentEffect: 'bug',
    visual: {
      bun: '带一点焦痕',
      filling: '薯饼夹心，掉出一角',
      prop: '创可贴 + 汗滴',
      outfit: '卷袖子的卫衣',
      expression: '尴尬笑，额头冒汗',
      color: '#a9691f',
      bunShape: 'scorched',
    },
  },
  {
    id: 'zen-veggie',
    name: '佛系蔬菜堡',
    keyword: '不争不抢、养生、慢慢来',
    tagline: '都行，都可以，看你。',
    vec: [-1, -1, -1, 0, -1],
    agentEffect: 'slack',
    visual: {
      bun: '全麦粗粮包，颜色最淡',
      filling: '厚蔬菜层，几乎无肉',
      prop: '一片叶子 + 茶杯',
      outfit: '宽松棉麻衬衫',
      expression: '闭眼，淡定微笑',
      color: '#9cbf6b',
      bunShape: 'wholegrain',
    },
  },
];

export const PERSONA_BY_ID: Record<PersonaId, Persona> = PERSONAS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PersonaId, Persona>,
);

/** 自查：ID 必须唯一，且必须有 8 个 */
const uniqueIds = new Set(PERSONAS.map((p) => p.id));
if (uniqueIds.size !== PERSONAS.length) {
  throw new Error('[persona] personaId 存在重复');
}
