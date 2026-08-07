import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠️ Play 스토어 첫 업로드 전 최종 확정 필요 (업로드 후 변경 불가)
  appId: 'com.metah.defenehero',
  appName: '용사 수학 디펜스',
  webDir: 'www',
  android: {
    allowMixedContent: false,
  },
  backgroundColor: '#bfe3ff',
};

export default config;
