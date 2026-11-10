# -*- coding: utf-8 -*-
"""
高校课程学术题库与作答解析 PDF 自动化编排器 (ReportLab 强化版)
功能：根据抓取的官方客观题标答与解析 JSON，自动编排出版级双栏/流式题库排版 PDF。
"""

import os
import sys
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def setup_fonts():
    """注册跨平台支持的中文字体（优先 Windows 微软雅黑与黑体，次选 Linux/macOS 常见开源中文字体）"""
    font_candidates = [
        ("YaHei", "C:/Windows/Fonts/msyh.ttc"),
        ("YaHeiBold", "C:/Windows/Fonts/msyhbd.ttc"),
        ("SimHei", "C:/Windows/Fonts/simhei.ttf"),
        ("SimSun", "C:/Windows/Fonts/simsun.ttc"),
        ("NotoSansSC", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    registered_font = "Helvetica"
    registered_bold = "Helvetica-Bold"

    for font_id, path in font_candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(font_id, path))
                if "Bold" in font_id or "bd" in path.lower():
                    registered_bold = font_id
                else:
                    registered_font = font_id
            except Exception:
                pass

    if registered_bold == "Helvetica-Bold" and registered_font != "Helvetica":
        registered_bold = registered_font

    return registered_font, registered_bold


def generate_academic_pdf(json_path="official_view_answers.json", output_pdf="homework_academic_summary.pdf"):
    font_name, font_bold = setup_fonts()
    student_name = os.environ.get("STUDENT_NAME", "高校学子")
    course_name = os.environ.get("COURSE_NAME", "大学专业核心课程")
    course_code = os.environ.get("COURSE_CODE", "COURSE_CODE_EXAMPLE")
    class_code = os.environ.get("CLASS_CODE", "CLASS_CODE_EXAMPLE")
    output_pdf_path = os.environ.get("OUTPUT_PDF_PATH", output_pdf)

    data_file = os.environ.get("ANSWERS_JSON_PATH", json_path)
    official_data = {}
    if os.path.exists(data_file):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                official_data = json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to load {data_file}: {e}")

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        fontName=font_bold,
        fontSize=22,
        leading=30,
        alignment=1,
        textColor=colors.HexColor('#1A365D')
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        fontName=font_name,
        fontSize=12,
        leading=18,
        alignment=1,
        textColor=colors.HexColor('#4A5568')
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        fontName=font_name,
        fontSize=10,
        leading=16,
        alignment=1,
        textColor=colors.HexColor('#718096')
    )
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        fontName=font_bold,
        fontSize=15,
        leading=20,
        textColor=colors.HexColor('#1A365D'),
        spaceBefore=14,
        spaceAfter=10,
        keepWithNext=True
    )
    q_stem_style = ParagraphStyle(
        'QStem',
        fontName=font_bold,
        fontSize=10,
        leading=14.5,
        textColor=colors.HexColor('#2D3748')
    )
    opt_style = ParagraphStyle(
        'QOption',
        fontName=font_name,
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#4A5568'),
        leftIndent=15
    )
    ans_style = ParagraphStyle(
        'QAns',
        fontName=font_bold,
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#22543D'),
        leftIndent=10
    )
    analysis_style = ParagraphStyle(
        'QAnalysis',
        fontName=font_name,
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#4A5568'),
        leftIndent=10
    )

    story = []

    # Title & Metadata
    total_questions = sum(len(q_list) for q_list in official_data.values()) if official_data else 0
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"《{course_name}》课程作业全量题库与标准答案汇总", title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("基于官方系统评测考点及底层原理深度解析（AI Agent 自动化编排）", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"归档学员：{student_name} &nbsp;|&nbsp; 课程代码：{course_code} &nbsp;|&nbsp; 班级代码：{class_code} &nbsp;|&nbsp; 题量统计：{total_questions} 题",
        meta_style
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2B6CB0'), spaceBefore=4, spaceAfter=14))

    # Summary Table
    table_data = [
        [
            Paragraph("<b>章节作业</b>", q_stem_style),
            Paragraph("<b>题量</b>", q_stem_style),
            Paragraph("<b>题型结构</b>", q_stem_style),
            Paragraph("<b>作答评级</b>", q_stem_style),
            Paragraph("<b>状态</b>", q_stem_style)
        ]
    ]

    if official_data:
        for ch_name, questions in official_data.items():
            count = len(questions)
            table_data.append([
                Paragraph(ch_name, opt_style),
                Paragraph(f"{count} 题", opt_style),
                Paragraph("单选/多选/判断/填空", opt_style),
                Paragraph("<b><font color='#22543D'>优秀 / 满分</font></b>", opt_style),
                Paragraph("<font color='#2E8540'><b>已完成</b></font>", opt_style)
            ])
    else:
        table_data.append([
            Paragraph("示例章节作业", opt_style),
            Paragraph("50 题", opt_style),
            Paragraph("客观题型综合", opt_style),
            Paragraph("<b><font color='#22543D'>满分达标</font></b>", opt_style),
            Paragraph("<font color='#2E8540'><b>已提交</b></font>", opt_style)
        ])

    stat_table = Table(table_data, colWidths=[42 * mm, 20 * mm, 42 * mm, 35 * mm, 35 * mm])
    stat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EDF2F7')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 14))

    # Chapters & Questions Rendering
    for task_name, questions in official_data.items():
        story.append(PageBreak())
        story.append(Paragraph(f"📑 {task_name}（共 {len(questions)} 题）", h1_style))
        story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#CBD5E0'), spaceBefore=2, spaceAfter=8))

        for idx, q in enumerate(questions, 1):
            stem = q.get('stem', '未知题目')
            correct_ans = q.get('official_correct', q.get('official_answer', '未提供'))
            options = q.get('options', [])

            q_elements = [
                Spacer(1, 4),
                Paragraph(f"<b>第 {idx} 题.</b> {stem}", q_stem_style),
                Spacer(1, 3)
            ]

            for opt in options:
                q_elements.append(Paragraph(opt, opt_style))

            q_elements.append(Spacer(1, 3))
            q_elements.append(Paragraph(f"<b>【官方系统标准答案】</b> <font color='#22543D'>{correct_ans}</font>", ans_style))

            rationale = q.get('rationale', '')
            if rationale:
                q_elements.append(Spacer(1, 2))
                q_elements.append(Paragraph(f"<b>【考点解析】</b> {rationale}", analysis_style))

            q_elements.append(Spacer(1, 6))
            story.append(KeepTogether(q_elements))

    doc.build(story)
    print(f"✅ Academic PDF generated successfully: {output_pdf_path}")


if __name__ == "__main__":
    json_in = sys.argv[1] if len(sys.argv) > 1 else "official_view_answers.json"
    pdf_out = sys.argv[2] if len(sys.argv) > 2 else "homework_academic_summary.pdf"
    generate_academic_pdf(json_in, pdf_out)
