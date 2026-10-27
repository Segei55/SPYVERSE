import { GameModifier } from '../../shared/src/index';

export const AVAILABLE_MODIFIERS: GameModifier[] = [
  {
    id: 'mod_blitz',
    name: 'Блиц-раунд',
    description: 'Время обсуждения сокращено на 40%. Решения нужно принимать молниеносно!',
    icon: 'Zap',
    type: 'time_reduced',
    active: false,
  },
  {
    id: 'mod_blind_vote',
    name: 'Слепое голосование',
    description: 'Голоса участников скрыты от остальных до момента оглашения окончательного вердикта.',
    icon: 'EyeOff',
    type: 'blind_vote',
    active: false,
  },
  {
    id: 'mod_whisper',
    name: 'Шёпот подозрений',
    description: 'Вопросы разрешено задавать только игроку напротив или через одного.',
    icon: 'MessageSquareShare',
    type: 'whisper_mode',
    active: false,
  },
  {
    id: 'mod_radio_static',
    name: 'Радиопомехи',
    description: 'Спецслужбы перехватывают связь: таймер скрывает последние 30 секунд раунда!',
    icon: 'Radio',
    type: 'radio_static',
    active: false,
  },
];
