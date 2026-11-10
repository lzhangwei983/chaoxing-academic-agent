# -*- coding: utf-8 -*-
"""
高校小组课题汇报 PPTX 与 PDF 综合生成器 (Agent 自动化通用版)
功能：根据结构化主题与提纲，自动生成高颜值 16:9 汇报 PPT 与排版精美的学术研究报告 PDF。

依赖库安装：
    pip install python-pptx reportlab
"""

import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE


def setup_chinese_fonts():
    """注册 Windows 系统自带中文字体到 ReportLab"""
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        return "Helvetica"

    font_paths = [
        ("SimHei", "C:/Windows/Fonts/simhei.ttf"),
        ("SimSun", "C:/Windows/Fonts/simsun.ttc"),
        ("MicrosoftYaHei", "C:/Windows/Fonts/msyh.ttc"),
    ]
    primary_font = "Helvetica"
    for name, path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                primary_font = name
                break
            except Exception:
                pass
    return primary_font


def build_academic_presentation(output_pptx_path, title, subtitle, author_info, slides_data):
    """
    生成 16:9 极简高雅学术风汇报 PPTX
    """
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # 配色方案：学术深黛青 + 浅灰白底 + 点缀金红
    C_PRIMARY = RGBColor(26, 54, 93)     # 深蓝
    C_TEXT_DARK = RGBColor(45, 55, 72)   # 炭灰
    C_ACCENT = RGBColor(197, 48, 48)     # 雅红/金
    C_BG_CARD = RGBColor(247, 250, 252)  # 卡片微灰底
    C_WHITE = RGBColor(255, 255, 255)

    # 1. 封面页
    slide = prs.slides.add_slide(blank_layout)
    bg_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg_box.fill.solid()
    bg_box.fill.fore_color.rgb = C_PRIMARY
    bg_box.line.fill.background()

    tb = slide.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(10.9), Inches(3.0))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = title
    p0.font.size = Pt(36)
    p0.font.bold = True
    p0.font.color.rgb = C_WHITE

    p1 = tf.add_paragraph()
    p1.text = subtitle
    p1.font.size = Pt(20)
    p1.font.color.rgb = RGBColor(226, 232, 240)
    p1.space_before = Pt(14)

    p2 = tf.add_paragraph()
    p2.text = author_info
    p2.font.size = Pt(14)
    p2.font.color.rgb = RGBColor(203, 213, 225)
    p2.space_before = Pt(28)

    # 2. 内容页循环
    for s_item in slides_data:
        slide = prs.slides.add_slide(blank_layout)
        
        # 顶部标题栏装饰条
        dec = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(0.6), Inches(0.12), Inches(0.7))
        dec.fill.solid()
        dec.fill.fore_color.rgb = C_ACCENT
        dec.line.fill.background()

        # 标题
        tb_title = slide.shapes.add_textbox(Inches(1.1), Inches(0.55), Inches(11.0), Inches(0.8))
        tf_t = tb_title.text_frame
        p_t = tf_t.paragraphs[0]
        p_t.text = s_item.get('title', '章节要点')
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = C_PRIMARY

        # 左右双卡片或多项列表
        points = s_item.get('points', [])
        top_offset = Inches(1.6)
        card_w = Inches(11.7)
        card_h = Inches(5.2)

        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), top_offset, card_w, card_h)
        card.fill.solid()
        card.fill.fore_color.rgb = C_BG_CARD
        card.line.color.rgb = RGBColor(226, 232, 240)

        tb_c = slide.shapes.add_textbox(Inches(1.1), top_offset + Inches(0.3), card_w - Inches(0.6), card_h - Inches(0.6))
        tf_c = tb_c.text_frame
        tf_c.word_wrap = True

        for idx, pt_text in enumerate(points):
            p = tf_c.paragraphs[0] if idx == 0 else tf_c.add_paragraph()
            p.text = f"• {pt_text}"
            p.font.size = Pt(16)
            p.font.color.rgb = C_TEXT_DARK
            p.space_after = Pt(12)

    prs.save(output_pptx_path)
    print(f"[PresentationBuilder] PPTX 生成成功: {output_pptx_path}")


def build_research_report_pdf(output_pdf_path, title, author_info, sections):
    """
    生成排版规范的学术研究报告 PDF
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        print("[PresentationBuilder] 提示：未检测到 reportlab 库，无法生成 PDF。请运行: pip install reportlab")
        return

    font_name = setup_chinese_fonts()
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=20,
        leading=26,
        alignment=1, # 居中
        textColor=colors.HexColor('#1A365D'),
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'RepMeta',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=colors.HexColor('#4A5568'),
        spaceAfter=20
    )

    h2_style = ParagraphStyle(
        'RepH2',
        parent=styles['Heading2'],
        fontName=font_name,
        fontSize=14,
        leading=20,
        textColor=colors.HexColor('#2B6CB0'),
        spaceBefore=14,
        spaceAfter=8
    )

    body_style = ParagraphStyle(
        'RepBody',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10.5,
        leading=18,
        textColor=colors.HexColor('#2D3748'),
        firstLineIndent=21, # 首行缩进两字
        spaceAfter=6
    )

    story = [
        Paragraph(title, title_style),
        Paragraph(author_info, meta_style),
        Spacer(1, 10)
    ]

    for sec in sections:
        story.append(Paragraph(sec.get('heading', ''), h2_style))
        for para in sec.get('paragraphs', []):
            story.append(Paragraph(para, body_style))
        story.append(Spacer(1, 8))

    doc.build(story)
    print(f"[PresentationBuilder] PDF 报告生成成功: {output_pdf_path}")


if __name__ == '__main__':
    # 示例运行调用
    demo_slides = [
        {
            "title": "一、研究背景与核心变量",
            "points": [
                "立足历史事实，挖掘重大工程背后的政治变量、经济组织力与社会动员机制。",
                "对比近代历史与新中国成立初期在工程技术、资金筹措与劳动力组织方面的本质跃迁。",
                "形成从微观工程细节到宏观国家治理效能的严谨推导链条。"
            ]
        },
        {
            "title": "二、历史启示与当代观照",
            "points": [
                "发挥集中力量办大事的制度优越性，破解复杂技术与资源瓶颈。",
                "以人民为中心的发展思想在重点工程中的实证体现与传承。",
                "对新工科青年学子立足专业报国、强化工程伦理与历史担当的现实观照。"
            ]
        }
    ]

    out_dir = os.path.dirname(os.path.abspath(__file__))
    build_academic_presentation(
        os.path.join(out_dir, "示例_高校小组汇报.pptx"),
        "高校小组研究汇报示范样稿",
        "基于历史背景与工程治理的跨学科探析",
        "汇报团队：第3课题组 | 指导教师：高校课程组",
        demo_slides
    )
