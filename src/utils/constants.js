/**
 * Game Constants
 * All role / state / team identifiers and their Arabic display strings.
 *
 * The internal `GameState` / `Role` / `Team` *keys* stay in English so the
 * state machine keeps working without changes. Only the *values* and the
 * display strings are Arabic.
 */

const GameState = Object.freeze({
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  NIGHT: 'NIGHT',
  NIGHT_RESULT: 'NIGHT_RESULT',
  DAY: 'DAY',
  VOTING: 'VOTING',
  ENDED: 'ENDED'
});

const Role = Object.freeze({
  KILLER: 'القاتل',
  DOCTOR: 'الطبيب',
  DETECTIVE: 'المحقق',
  CITIZEN: 'مواطن'
});

const RoleEmoji = Object.freeze({
  [Role.KILLER]: '🔪',
  [Role.DOCTOR]: '💉',
  [Role.DETECTIVE]: '🔍',
  [Role.CITIZEN]: '👤'
});

const RoleDescription = Object.freeze({
  [Role.KILLER]:
    'مهمتك هي التخلص من جميع المواطنين والأدوار الخاصة.\n' +
    'كل ليلة، ستتلقى رسالة خاصة (DM) بقائمة اللاعبين الأحياء.\n' +
    'اختر ضحية لقتلها. إذا حمى الطبيب هدفك، ستفشل عملية القتل.',

  [Role.DOCTOR]:
    'مهمتك هي حماية المواطنين من القاتل.\n' +
    'كل ليلة، ستتلقى رسالة خاصة (DM) بقائمة اللاعبين الأحياء.\n' +
    'اختر شخصاً لحمايته. إذا استهدف القاتل نفس اللاعب، سينجو.\n' +
    'يمكنك حماية نفسك.',

  [Role.DETECTIVE]:
    'مهمتك هي كشف هوية القاتل.\n' +
    'كل ليلة، ستتلقى رسالة خاصة (DM) بقائمة اللاعبين الأحياء.\n' +
    'اختر لاعباً للتحقيق معه. ستعرف ما إذا كان القاتل أم لا.',

  [Role.CITIZEN]:
    'مهمتك هي كشف القاتل والقضاء عليه بالتصويت خلال النهار.\n' +
    'ليس لديك أي قدرات ليلية. ناقش مع اللاعبين الآخرين وصوّت بحكمة.'
});

const Team = Object.freeze({
  KILLERS: 'القتلة',
  CITIZENS: 'المواطنون'
});

/** Arabic display name for every internal state. */
const StateDisplay = Object.freeze({
  [GameState.WAITING]: 'في الانتظار',
  [GameState.STARTING]: 'جاري البدء',
  [GameState.NIGHT]: 'الليل',
  [GameState.NIGHT_RESULT]: 'نتيجة الليل',
  [GameState.DAY]: 'النهار',
  [GameState.VOTING]: 'التصويت',
  [GameState.ENDED]: 'انتهت'
});

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 10;

module.exports = {
  GameState,
  Role,
  RoleEmoji,
  RoleDescription,
  Team,
  StateDisplay,
  MIN_PLAYERS,
  MAX_PLAYERS
};
