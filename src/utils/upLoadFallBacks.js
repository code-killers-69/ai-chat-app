export const handleFallBacks = async (Ids, Blobs) => {
  //  空置处理
  if (!Array.isArray(Ids) || !Array.isArray(Blobs) || Ids.length === 0) {
    throw new Error('传入数组错误: Ids 或 Blobs 格式不正确或为空');
  }

  if (Ids.length !== Blobs.length) {
    throw new Error(`id和blob数量不一致,id:${Ids.length},blob:${Blobs.length}`);
  }

  //  初始化信息
  const formData = new FormData();
  const token = localStorage.getItem('token');

  //  数据装车上传
  formData.append('imageIds', JSON.stringify(Ids));
  for (const blob of Blobs) {
    formData.append('fallbacks', blob);
  }

  const response = await fetch(
    'http://scj.dolmo.top:3001/api/chat/upload-fallbacks',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(`服务响应错误:${response.status}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.data;
  } else {
    throw new Error(`服务器存储失败：${data.message}`);
  }
};
