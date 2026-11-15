
import { useEffect, useState } from "react";

const API = "http://localhost:3000/api";

async function api(path, token = "", method = "GET", body = null) {
    const res = await fetch(API + path, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || "요청에 실패했습니다.");
    }
    return data;
}

const inputStyle = {
    padding: 10,
    margin: "5px 0",
    width: "100%",
    boxSizing: "border-box"
};

const buttonStyle = {
    padding: "8px 13px",
    margin: 4,
    cursor: "pointer"
};

function Input({ label, value, onChange, type = "text" }) {
    return (
        <label style={{ display: "block", marginBottom: 8 }}>
            {label}
            <input
                style={inputStyle}
                type={type}
                value={value ?? ""}
                onChange={e => onChange(e.target.value)}
                required
            />
        </label>
    );
}

function Button({ children, ...props }) {
    return (
        <button style={buttonStyle} {...props}>
            {children}
        </button>
    );
}

function App() {
    const [page, setPage] = useState("home");
    const [photos, setPhotos] = useState([]);
    const [comments, setComments] = useState({});
    const [token, setToken] = useState("");
    const [user, setUser] = useState(null);

    const [login, setLogin] = useState({ email: "", password: "" });
    const [signup, setSignup] = useState({
        email: "", password: "", nickname: "",
        phone_number: "", entry_year: "", student_id: ""
    });

    const [profile, setProfile] = useState({
        nickname: "", phone_number: "", entry_year: "", student_id: ""
    });

    const [photo, setPhoto] = useState({
        title: "", description: "", image_url: ""
    });
    const [editingPhoto, setEditingPhoto] = useState(null);
    const [commentText, setCommentText] = useState({});
    const [editingComment, setEditingComment] = useState(null);
    const [error, setError] = useState("");

    const loadPhotos = async () => {
        try {
            const data = await api("/photos");
            setPhotos(data.photos || []);
        } catch (e) {
            setError(e.message);
        }
    };

    const loadComments = async (list) => {
        const result = {};
        await Promise.all(list.map(async p => {
            try {
                const data = await api(`/photos/${p.id}/comments`);
                result[p.id] = data.comments || [];
            } catch {
                result[p.id] = [];
            }
        }));
        setComments(result);
    };

    useEffect(() => {
        loadPhotos();
    }, []);

    useEffect(() => {
        if (photos.length) loadComments(photos);
    }, [photos]);

    const changePage = async (next) => {
        setError("");
        setPage(next);

        if (next === "mypage" && token) {
            try {
                const data = await api("/mypage", token);
                setProfile({
                    nickname: data.user.nickname || "",
                    phone_number: data.user.phone_number || "",
                    entry_year: data.user.entry_year || "",
                    student_id: data.user.student_id || ""
                });
            } catch (e) {
                setError(e.message);
            }
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            await api("/signup", "", "POST", signup);
            alert("회원가입 성공!");
            setPage("login");
        } catch (e) {
            setError(e.message);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const data = await api("/login", "", "POST", login);
            setToken(data.token);
            setUser(data.user);
            setPage("home");
            setError("");
            alert("로그인 성공!");
        } catch (e) {
            setError(e.message);
        }
    };

    const logout = () => {
        setToken("");
        setUser(null);
        setPage("home");
    };

    const updateProfile = async (e) => {
        e.preventDefault();
        try {
            const data = await api("/mypage", token, "PUT", profile);
            if (data.user) setUser(data.user);
            alert("회원정보가 수정되었습니다.");
        } catch (e) {
            setError(e.message);
        }
    };

    const withdraw = async () => {
        if (!window.confirm("정말 탈퇴하시겠습니까?")) return;
        try {
            await api("/mypage", token, "DELETE");
            logout();
            alert("회원탈퇴가 완료되었습니다.");
        } catch (e) {
            setError(e.message);
        }
    };

    const savePhoto = async (e) => {
        e.preventDefault();
        try {
            if (editingPhoto) {
                await api(`/photos/${editingPhoto}`, token, "PUT", photo);
            } else {
                await api("/photos", token, "POST", photo);
            }
            setPhoto({ title: "", description: "", image_url: "" });
            setEditingPhoto(null);
            await loadPhotos();
            alert("사진이 저장되었습니다.");
        } catch (e) {
            setError(e.message);
        }
    };

    const editPhoto = (p) => {
        setEditingPhoto(p.id);
        setPhoto({
            title: p.title || "",
            description: p.description || "",
            image_url: p.image_url || ""
        });
        window.scrollTo(0, 0);
    };

    const deletePhoto = async (id) => {
        if (!window.confirm("사진을 삭제하시겠습니까?")) return;
        try {
            await api(`/photos/${id}`, token, "DELETE");
            loadPhotos();
        } catch (e) {
            setError(e.message);
        }
    };

    const addComment = async (photoId) => {
        const content = commentText[photoId]?.trim();
        if (!content) return;
        try {
            await api(`/photos/${photoId}/comments`, token, "POST", { content });
            setCommentText({ ...commentText, [photoId]: "" });
            loadComments(photos);
        } catch (e) {
            setError(e.message);
        }
    };

    const saveComment = async (id) => {
        try {
            await api(`/comments/${id}`, token, "PUT", {
                content: editingComment.content
            });
            setEditingComment(null);
            loadComments(photos);
        } catch (e) {
            setError(e.message);
        }
    };

    const deleteComment = async (id) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        try {
            await api(`/comments/${id}`, token, "DELETE");
            loadComments(photos);
        } catch (e) {
            setError(e.message);
        }
    };

    const setSignupField = (key, value) =>
        setSignup({ ...signup, [key]: value });

    const setProfileField = (key, value) =>
        setProfile({ ...profile, [key]: value });

    const setPhotoField = (key, value) =>
        setPhoto({ ...photo, [key]: value });

    return (
        <main style={{
            maxWidth: 850,
            margin: "30px auto",
            padding: 20,
            fontFamily: "Arial, sans-serif"
        }}>
            <header style={{ borderBottom: "1px solid #ddd", paddingBottom: 15 }}>
                <h1 onClick={() => changePage("home")} style={{ cursor: "pointer" }}>
                    My Photo Blog
                </h1>

                <Button onClick={() => changePage("home")}>사진 목록</Button>

                {token ? (
                    <>
                        <Button onClick={() => changePage("mypage")}>마이페이지</Button>
                        <Button onClick={logout}>로그아웃</Button>
                        <span>{user?.nickname}님</span>
                    </>
                ) : (
                    <>
                        <Button onClick={() => changePage("login")}>로그인</Button>
                        <Button onClick={() => changePage("signup")}>회원가입</Button>
                    </>
                )}
            </header>

            {error && (
                <p style={{ color: "red" }}>{error}</p>
            )}

            {page === "signup" && (
                <section>
                    <h2>회원가입</h2>
                    <form onSubmit={handleSignup}>
                        <Input label="이메일" value={signup.email}
                            onChange={v => setSignupField("email", v)} type="email" />
                        <Input label="비밀번호" value={signup.password}
                            onChange={v => setSignupField("password", v)} type="password" />
                        <Input label="닉네임" value={signup.nickname}
                            onChange={v => setSignupField("nickname", v)} />
                        <Input label="전화번호" value={signup.phone_number}
                            onChange={v => setSignupField("phone_number", v)} />
                        <Input label="입학년도" value={signup.entry_year}
                            onChange={v => setSignupField("entry_year", v)} />
                        <Input label="학번" value={signup.student_id}
                            onChange={v => setSignupField("student_id", v)} />
                        <Button type="submit">가입하기</Button>
                    </form>
                </section>
            )}

            {page === "login" && (
                <section>
                    <h2>로그인</h2>
                    <form onSubmit={handleLogin}>
                        <Input label="이메일" value={login.email}
                            onChange={v => setLogin({ ...login, email: v })} type="email" />
                        <Input label="비밀번호" value={login.password}
                            onChange={v => setLogin({ ...login, password: v })} type="password" />
                        <Button type="submit">로그인</Button>
                    </form>
                </section>
            )}

            {page === "mypage" && token && (
                <section>
                    <h2>마이페이지</h2>
                    <p>이메일: {user?.email}</p>
                    <form onSubmit={updateProfile}>
                        <Input label="닉네임" value={profile.nickname}
                            onChange={v => setProfileField("nickname", v)} />
                        <Input label="전화번호" value={profile.phone_number}
                            onChange={v => setProfileField("phone_number", v)} />
                        <Input label="입학년도" value={profile.entry_year}
                            onChange={v => setProfileField("entry_year", v)} />
                        <Input label="학번" value={profile.student_id}
                            onChange={v => setProfileField("student_id", v)} />
                        <Button type="submit">회원정보 수정</Button>
                    </form>
                    <Button onClick={withdraw}>회원탈퇴</Button>
                </section>
            )}

            {page === "home" && (
                <section>
                    <h2>사진 게시판</h2>

                    {token && (
                        <form onSubmit={savePhoto} style={{
                            padding: 15,
                            background: "#f5f5f5",
                            marginBottom: 25
                        }}>
                            <h3>{editingPhoto ? "사진 수정" : "사진 등록"}</h3>
                            <Input label="제목" value={photo.title}
                                onChange={v => setPhotoField("title", v)} />
                            <Input label="설명" value={photo.description}
                                onChange={v => setPhotoField("description", v)} />
                            <Input label="이미지 주소" value={photo.image_url}
                                onChange={v => setPhotoField("image_url", v)} />
                            <Button type="submit">
                                {editingPhoto ? "수정 완료" : "등록하기"}
                            </Button>
                            {editingPhoto && (
                                <Button type="button" onClick={() => {
                                    setEditingPhoto(null);
                                    setPhoto({ title: "", description: "", image_url: "" });
                                }}>
                                    취소
                                </Button>
                            )}
                        </form>
                    )}

                    {photos.map(p => (
                        <article key={p.id} style={{
                            border: "1px solid #ddd",
                            padding: 15,
                            marginBottom: 25,
                            borderRadius: 8
                        }}>
                            <h3>{p.title}</h3>
                            {p.image_url && (
                                <img src={p.image_url} alt={p.title}
                                    style={{ width: "100%", maxHeight: 450, objectFit: "cover" }} />
                            )}
                            <p>{p.description}</p>

                            {token && (
                                <>
                                    <Button onClick={() => editPhoto(p)}>사진 수정</Button>
                                    <Button onClick={() => deletePhoto(p.id)}>사진 삭제</Button>
                                </>
                            )}

                            <hr />
                            <h4>댓글</h4>

                            {(comments[p.id] || []).map(c => (
                                <div key={c.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                                    <b>{c.nickname}</b>

                                    {editingComment?.id === c.id ? (
                                        <>
                                            <input
                                                style={inputStyle}
                                                value={editingComment.content}
                                                onChange={e => setEditingComment({
                                                    ...editingComment,
                                                    content: e.target.value
                                                })}
                                            />
                                            <Button onClick={() => saveComment(c.id)}>저장</Button>
                                            <Button onClick={() => setEditingComment(null)}>취소</Button>
                                        </>
                                    ) : (
                                        <>
                                            <p>{c.content}</p>
                                            {token && (
                                                <>
                                                    <Button onClick={() => setEditingComment({
                                                        id: c.id,
                                                        content: c.content
                                                    })}>수정</Button>
                                                    <Button onClick={() => deleteComment(c.id)}>삭제</Button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}

                            {token ? (
                                <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                                    <input
                                        style={{ ...inputStyle, flex: 1 }}
                                        placeholder="댓글을 입력하세요"
                                        value={commentText[p.id] || ""}
                                        onChange={e => setCommentText({
                                            ...commentText,
                                            [p.id]: e.target.value
                                        })}
                                    />
                                    <Button onClick={() => addComment(p.id)}>등록</Button>
                                </div>
                            ) : (
                                <p>댓글을 작성하려면 로그인하세요.</p>
                            )}
                        </article>
                    ))}
                </section>
            )}
        </main>
    );
}

export default App;
