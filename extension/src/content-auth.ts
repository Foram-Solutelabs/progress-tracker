window.addEventListener('message', event => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  if (event.data?.type !== 'LT_SET_TOKEN') return
  chrome.runtime.sendMessage({
    type: 'SET_TOKEN',
    token: event.data.token,
    userName: event.data.userName ?? '',
  })
})
