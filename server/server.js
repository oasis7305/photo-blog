
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./config/db");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// JWT 로그인 인증
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "로그인이 필요합니다."
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "로그인 인증이 만료되었거나 올바르지 않습니다."
        });
    }
}

// 서버 확인
app.get("/", (req, res) => {
    res.send("PhotoBlog 서버 실행 성공!");
});

// 데이터베이스 연결 확인
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT DATABASE() AS databaseName");

        res.json({
            success: true,
            message: "MySQL 연결 성공!",
            database: rows[0].databaseName
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "MySQL 연결 실패"
        });
    }
});

// 사진 목록 조회
app.get("/api/photos", async (req, res) => {
    try {
        const [photos] = await db.query(
            "SELECT * FROM photos ORDER BY id DESC"
        );

        res.json({ success: true, photos });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "사진 목록 조회 실패"
        });
    }
});

// 회원가입
app.post("/api/signup", async (req, res) => {
    try {
        const {
            email, password, nickname,
            phone_number, entry_year, student_id
        } = req.body;

        if (!email || !password || !nickname) {
            return res.status(400).json({
                success: false,
                message: "이메일, 비밀번호, 닉네임은 필수입니다."
            });
        }

        const [users] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (users.length > 0) {
            return res.status(409).json({
                success: false,
                message: "이미 가입된 이메일입니다."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users
            (email, password, nickname, phone_number, entry_year, student_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                email, hashedPassword, nickname,
                phone_number || null,
                entry_year || null,
                student_id || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "회원가입이 완료되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "회원가입 중 오류가 발생했습니다."
        });
    }
});

// 로그인
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "이메일과 비밀번호를 입력해 주세요."
            });
        }

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0 ||
            !(await bcrypt.compare(password, users[0].password))) {
            return res.status(401).json({
                success: false,
                message: "이메일 또는 비밀번호가 올바르지 않습니다."
            });
        }

        const user = users[0];
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            message: "로그인 성공!",
            token,
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "로그인 중 오류가 발생했습니다."
        });
    }
});

// 마이페이지 정보 조회
app.get("/api/mypage", authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, email, nickname, phone_number, entry_year, student_id
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "회원정보를 찾을 수 없습니다."
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "회원정보 조회 실패"
        });
    }
});

// 마이페이지 회원정보 수정
app.put("/api/mypage", authMiddleware, async (req, res) => {
    try {
        const {
            nickname, phone_number, entry_year, student_id
        } = req.body;

        if (!nickname?.trim()) {
            return res.status(400).json({
                success: false,
                message: "닉네임을 입력해 주세요."
            });
        }

        await db.query(
            `UPDATE users
             SET nickname = ?, phone_number = ?,
                 entry_year = ?, student_id = ?
             WHERE id = ?`,
            [
                nickname.trim(),
                phone_number || null,
                entry_year || null,
                student_id || null,
                req.user.id
            ]
        );

        const [users] = await db.query(
            `SELECT id, email, nickname, phone_number, entry_year, student_id
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        res.json({
            success: true,
            message: "회원정보가 수정되었습니다!",
            user: users[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "회원정보 수정에 실패했습니다."
        });
    }
});

// 회원 탈퇴
app.delete("/api/mypage", authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM users WHERE id = ?",
            [req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "회원정보를 찾을 수 없습니다."
            });
        }

        res.json({
            success: true,
            message: "회원 탈퇴가 완료되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "회원 탈퇴에 실패했습니다."
        });
    }
});

// 특정 사진의 댓글 조회
app.get("/api/photos/:photoId/comments", async (req, res) => {
    try {
        const [comments] = await db.query(
            `SELECT comments.id, comments.photo_id, comments.user_id,
                    comments.content, comments.created_at, users.nickname
             FROM comments
             JOIN users ON comments.user_id = users.id
             WHERE comments.photo_id = ?
             ORDER BY comments.created_at ASC`,
            [req.params.photoId]
        );

        res.json({ success: true, comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "댓글 조회에 실패했습니다."
        });
    }
});

// 댓글 작성
app.post("/api/photos/:photoId/comments", authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({
                success: false,
                message: "댓글 내용을 입력해주세요."
            });
        }

        const [photos] = await db.query(
            "SELECT id FROM photos WHERE id = ?",
            [req.params.photoId]
        );

        if (photos.length === 0) {
            return res.status(404).json({
                success: false,
                message: "사진을 찾을 수 없습니다."
            });
        }

        const [result] = await db.query(
            "INSERT INTO comments (photo_id, user_id, content) VALUES (?, ?, ?)",
            [req.params.photoId, req.user.id, content.trim()]
        );

        const [comments] = await db.query(
            `SELECT comments.id, comments.photo_id, comments.user_id,
                    comments.content, comments.created_at, users.nickname
             FROM comments
             JOIN users ON comments.user_id = users.id
             WHERE comments.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "댓글이 작성되었습니다.",
            comment: comments[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "댓글 작성에 실패했습니다."
        });
    }
});

// 댓글 수정
app.put("/api/comments/:id", authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({
                success: false,
                message: "댓글 내용을 입력해주세요."
            });
        }

        const [result] = await db.query(
            "UPDATE comments SET content = ? WHERE id = ? AND user_id = ?",
            [content.trim(), req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "댓글을 찾을 수 없거나 수정 권한이 없습니다."
            });
        }

        res.json({
            success: true,
            message: "댓글이 수정되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "댓글 수정 실패"
        });
    }
});

// 댓글 삭제
app.delete("/api/comments/:id", authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM comments WHERE id = ? AND user_id = ?",
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "댓글을 찾을 수 없거나 삭제 권한이 없습니다."
            });
        }

        res.json({
            success: true,
            message: "댓글이 삭제되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "댓글 삭제 실패"
        });
    }
});

// 사진 등록
app.post("/api/photos", authMiddleware, async (req, res) => {
    try {
        const { title, description, image_url } = req.body;

        if (!title || !image_url) {
            return res.status(400).json({
                success: false,
                message: "사진 제목과 이미지 주소를 입력해주세요."
            });
        }

        const [result] = await db.query(
            "INSERT INTO photos (title, description, image_url) VALUES (?, ?, ?)",
            [title, description || "", image_url]
        );

        res.status(201).json({
            success: true,
            message: "사진이 등록되었습니다.",
            photoId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "사진 등록에 실패했습니다."
        });
    }
});

// 사진 수정
app.put("/api/photos/:id", authMiddleware, async (req, res) => {
    try {
        const { title, description, image_url } = req.body;

        if (!title || !image_url) {
            return res.status(400).json({
                success: false,
                message: "사진 제목과 이미지 주소를 입력해주세요."
            });
        }

        const [result] = await db.query(
            `UPDATE photos
             SET title = ?, description = ?, image_url = ?
             WHERE id = ?`,
            [title, description || "", image_url, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "사진을 찾을 수 없습니다."
            });
        }

        res.json({
            success: true,
            message: "사진이 수정되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "사진 수정에 실패했습니다."
        });
    }
});

// 사진 삭제
app.delete("/api/photos/:id", authMiddleware, async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM photos WHERE id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "사진을 찾을 수 없습니다."
            });
        }

        res.json({
            success: true,
            message: "사진이 삭제되었습니다."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "사진 삭제에 실패했습니다."
        });
    }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버 실행 주소: http://localhost:${PORT}`);
});
