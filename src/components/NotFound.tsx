import React from 'react';

const NotFound: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>404 Not Found</h1>
      <p>抱歉，您访问的页面不存在。</p>
      <a href="/">返回首页</a>
    </div>
  );
};

export default NotFound;
