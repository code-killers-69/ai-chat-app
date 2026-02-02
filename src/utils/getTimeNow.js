export const getDate = () => {
  const date = new Date(Date.now())
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds=date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes} ${hours < 12 ? "AM" : "PM"}`
}