import { useState } from "react";
import { apiClient } from "../api/client.js";

export function LoginPage({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  return <main className="login-page"><section><p>家庭观察档案</p><h1>登录观察手册</h1><p>请使用家庭或平台账号登录后继续。</p><form onSubmit={async event => { event.preventDefault(); try { await apiClient.login(username, password); setNotice("登录成功，正在进入档案室…"); onAuthenticated?.(); } catch { setNotice("账号或密码不正确。") } }}><label>账号<input value={username} onChange={event => setUsername(event.target.value)} /></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><button type="submit">登录</button>{notice && <p>{notice}</p>}</form></section></main>;
}
