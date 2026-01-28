module.exports = {
  apps: [{
    name: 'personal-assistant-frontend',
    script: 'npx',
    args: ['serve', '-s', 'dist', '-l', '3005'],
    cwd: '/home/jd-server-admin/projects/personal-assistant/app',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
