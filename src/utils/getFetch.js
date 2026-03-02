import { ref } from 'vue';

const getFetch = async (
  url = '',
  needToken = false,
  { method = 'GET', headers = {}, body = null } = {},
) => {
  const error = ref('');
  const baseUrl = 'http://scj.dolmo.top:3001';
  const token = localStorage.getItem('token');

  //  处理请求头
  const fullHeaders = {
    ...headers,
    ...(needToken ? { Authorization: `Bearer ${token}` } : {}),
  };

  //  处理body
  if (body && headers['Content-Type'] == 'application/json') {
    body = JSON.stringify(body);
  }

  // 请求配置
  const option = {
    method: `${method}`,
    headers: fullHeaders,
    ...(body ? { body: body } : {}),
  };

  try {
    const response = await fetch(`${baseUrl}${url}`, option);
    if (response.status === 200) {
      //  流式路径
      if (url == '/api/chat/stream') {
        return response;
      }
      //  常规路径
      const data = await response.json();
      return data;
    } else {
      throw new Error('状态码错误');
    }
  } catch (err) {
    error.value = err;
    console.log('请求错误:', error.value);
  }
};

export default getFetch;
