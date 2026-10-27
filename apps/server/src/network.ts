import os from 'os';
import { ServerNetworkInterface } from '../../../packages/shared/src/index';

export function getAvailableNetworkInterfaces(): ServerNetworkInterface[] {
  const interfaces = os.networkInterfaces();
  const result: ServerNetworkInterface[] = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4') {
        let type: ServerNetworkInterface['type'] = 'other';
        if (net.internal) {
          type = 'loopback';
        } else if (net.address.startsWith('25.') || net.address.startsWith('26.')) {
          type = 'vpn'; // Hamachi (25.x) и Radmin VPN (26.x)
        } else if (
          net.address.startsWith('192.168.') ||
          net.address.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(net.address)
        ) {
          type = 'lan';
        }

        result.push({
          name,
          address: net.address,
          family: net.family,
          type,
        });
      }
    }
  }

  // Sort LAN and VPN first
  const order: Record<ServerNetworkInterface['type'], number> = {
    lan: 1,
    vpn: 2,
    other: 3,
    loopback: 4,
  };

  return result.sort((a, b) => {
    return (order[a.type] || 5) - (order[b.type] || 5);
  });
}
