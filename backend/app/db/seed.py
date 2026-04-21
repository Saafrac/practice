from __future__ import annotations

import asyncio
from dataclasses import dataclass

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.models import Group, Option, Question, StudentGroup, Test, TestType, User, UserRole
from app.db.session import SessionLocal


@dataclass(frozen=True)
class SeedQuestion:
    text: str
    topic: str
    difficulty: int
    options: tuple[str, str, str, str]
    correct_index: int
    explanation: str


def question_bank() -> list[SeedQuestion]:
    return [
        SeedQuestion("She ___ to school every day.", "grammar", -1, ("go", "goes", "going", "gone"), 1, "He/she/it uses verb + s in Present Simple."),
        SeedQuestion("I have lived here ___ 2020.", "prepositions", -1, ("for", "since", "at", "during"), 1, "Use 'since' with a start point in time."),
        SeedQuestion("Choose the correct article: I saw ___ elephant at the zoo.", "articles", -1, ("a", "an", "the", "no article"), 1, "'Elephant' starts with a vowel sound, so use 'an'."),
        SeedQuestion("They ___ football now.", "tenses", -1, ("play", "plays", "are playing", "played"), 2, "Action happening now uses Present Continuous."),
        SeedQuestion("Which word is closest in meaning to 'happy'?", "vocabulary", -1, ("angry", "sad", "joyful", "tired"), 2, "'Joyful' is a synonym of 'happy'."),
        SeedQuestion("I usually ___ coffee in the morning.", "grammar", -1, ("drink", "drinks", "am drinking", "drank"), 0, "With 'I usually' use Present Simple base form."),
        SeedQuestion("There ___ many books on the table.", "grammar", -1, ("is", "are", "was", "be"), 1, "'Books' is plural, so use 'are'."),
        SeedQuestion("Choose the correct preposition: He is good ___ math.", "prepositions", -1, ("in", "on", "at", "for"), 2, "We say 'good at' a subject/skill."),
        SeedQuestion("My sister ___ TV when I called her.", "tenses", 0, ("watched", "was watching", "is watching", "watches"), 1, "Interrupted past action takes Past Continuous."),
        SeedQuestion("If it rains, we ___ at home.", "grammar", 0, ("stay", "stays", "will stay", "stayed"), 2, "First conditional: if + present, will + base verb."),
        SeedQuestion("Choose the best word order.", "word_order", 0, ("Always I am late.", "I am always late.", "I always am late.", "Am I always late."), 1, "Adverb of frequency usually goes before the main verb."),
        SeedQuestion("We have ___ finished our homework.", "grammar", 0, ("yet", "already", "still", "ago"), 1, "In affirmative Present Perfect, 'already' is natural."),
        SeedQuestion("Which sentence is correct?", "articles", 0, ("She is teacher.", "She is a teacher.", "She is the teacher every day.", "She is an teacher."), 1, "Use indefinite article with professions."),
        SeedQuestion("The movie was boring, ___ we left early.", "grammar", 0, ("because", "so", "but", "if"), 1, "'So' introduces a result."),
        SeedQuestion("By the time I arrived, they ___ dinner.", "tenses", 1, ("finished", "had finished", "have finished", "were finishing"), 1, "Past Perfect for an action completed before another past event."),
        SeedQuestion("Choose the synonym for 'purchase'.", "vocabulary", 1, ("borrow", "sell", "buy", "throw"), 2, "'Purchase' means 'buy'."),
        SeedQuestion("I look forward to ___ you.", "grammar", 1, ("meet", "meeting", "met", "be meet"), 1, "After 'look forward to' use gerund."),
        SeedQuestion("Neither of the answers ___ correct.", "grammar", 1, ("are", "were", "is", "be"), 2, "'Neither of' is treated as singular here."),
        SeedQuestion("He apologized ___ being late.", "prepositions", 1, ("for", "to", "at", "with"), 0, "We say 'apologize for' + noun/gerund."),
        SeedQuestion("Choose the best completion: If I ___ more time, I would travel.", "tenses", 1, ("have", "had", "will have", "am having"), 1, "Second conditional uses past form in if-clause."),
        SeedQuestion("No sooner ___ I entered than the phone rang.", "grammar", 2, ("did", "had", "have", "was"), 1, "Inversion pattern: No sooner had + subject + past participle."),
        SeedQuestion("Hardly had we sat down when the film ___.", "tenses", 2, ("starts", "started", "has started", "was starting"), 1, "Narrating sequence in the past uses Past Simple."),
        SeedQuestion("Choose the most appropriate connector: He studied hard; ___, he failed.", "vocabulary", 2, ("therefore", "however", "moreover", "because"), 1, "'However' expresses contrast."),
        SeedQuestion("She insisted ___ paying for dinner.", "prepositions", 2, ("on", "in", "at", "to"), 0, "Collocation: insist on + gerund."),
        SeedQuestion("Only after the meeting ___ the mistake.", "word_order", 2, ("we realized", "did we realize", "we did realize", "realized we"), 1, "Fronted negative adverbial triggers inversion."),
        SeedQuestion("Read: 'Tom missed the bus because he woke up late.' Why did Tom miss the bus?", "reading", -1, ("The bus was canceled.", "He woke up late.", "He forgot his ticket.", "It was raining."), 1, "The sentence gives the direct reason."),
        SeedQuestion("Read: 'Anna studies every evening, so her grades improved.' What caused better grades?", "reading", 0, ("A new teacher", "More sleep", "Regular study", "Easy exams"), 2, "The text links evening study with improvement."),
        SeedQuestion("Read: 'The library closes at 8 PM, but students can use digital resources all night.' Which is true?", "reading", 0, ("No resources after 8 PM", "Digital resources are always available", "The library closes at 10 PM", "Students cannot study at night"), 1, "The sentence states digital access all night."),
        SeedQuestion("Read: 'Although the task was difficult, Maya finished it before the deadline.' What can we infer?", "reading", 1, ("Maya missed the deadline", "Maya gave up", "Maya completed difficult work on time", "The task was easy"), 2, "She finished despite difficulty and before deadline."),
        SeedQuestion("Read: 'Most students prefer short videos to long lectures for revision.' Best summary?", "reading", 1, ("Students dislike revision", "Long lectures are always better", "Short videos are generally preferred for review", "No one uses videos"), 2, "It restates the main point accurately."),
        SeedQuestion("Read: 'If pollution continues to rise, coastal cities may face frequent flooding.' Main risk?", "reading", 2, ("Lower internet speed", "Frequent flooding in coastal cities", "More mountains", "Fewer schools"), 1, "The sentence explicitly mentions flooding risk."),
        SeedQuestion("Choose the correct sentence.", "word_order", -1, ("I yesterday went to school.", "Yesterday I went to school.", "I went yesterday to school.", "Went I to school yesterday."), 1, "Standard word order: time expression + subject + verb."),
        SeedQuestion("Select the correct form: The information ___ very useful.", "grammar", 1, ("are", "were", "is", "be"), 2, "'Information' is uncountable singular."),
        SeedQuestion("We were tired, but we kept ___ until midnight.", "grammar", 0, ("work", "working", "to work", "worked"), 1, "'Keep' is followed by gerund."),
        SeedQuestion("Choose the best meaning of 'reliable'.", "vocabulary", 0, ("easy to break", "can be trusted", "very expensive", "newly invented"), 1, "'Reliable' means dependable/trustworthy."),
        SeedQuestion("I have not seen him ___ last Monday.", "prepositions", 0, ("for", "since", "from", "by"), 1, "Use 'since' with specific point in time."),
        SeedQuestion("If she ___ harder, she would have passed the exam.", "tenses", 2, ("studied", "had studied", "has studied", "was studying"), 1, "Third conditional: if + past perfect, would have + participle."),
        SeedQuestion("Choose the correct article: ___ Nile is the longest river in Africa.", "articles", 1, ("A", "An", "The", "No article"), 2, "Names of rivers take 'the'."),
        SeedQuestion("He suggested that we ___ earlier tomorrow.", "grammar", 1, ("leave", "leaves", "left", "to leave"), 0, "After 'suggested that' use base form (subjunctive style)."),
        SeedQuestion("Rarely ___ such a talented student.", "word_order", 2, ("I have seen", "have I seen", "I saw", "did I saw"), 1, "Negative adverb fronting requires inversion."),
    ]


async def seed_users_and_groups() -> None:
    demo_users = [
        ("Admin User", "admin@adaptive.test", UserRole.ADMIN, "Admin123!"),
        ("Teacher Emma", "teacher@adaptive.test", UserRole.TEACHER, "Teacher123!"),
        ("Student Alex", "alex@adaptive.test", UserRole.STUDENT, "Student123!"),
        ("Student Bella", "bella@adaptive.test", UserRole.STUDENT, "Student123!"),
        ("Student Chris", "chris@adaptive.test", UserRole.STUDENT, "Student123!"),
    ]

    async with SessionLocal() as session:
        existing_users = {
            user.email: user
            for user in (await session.execute(select(User))).scalars().all()
        }
        for full_name, email, role, raw_password in demo_users:
            if email in existing_users:
                existing_user = existing_users[email]
                existing_user.full_name = full_name
                existing_user.role = role
                existing_user.password_hash = get_password_hash(raw_password)
                continue
            session.add(
                User(
                    full_name=full_name,
                    email=email,
                    password_hash=get_password_hash(raw_password),
                    role=role,
                )
            )
        await session.flush()

        teacher = (await session.execute(select(User).where(User.email == "teacher@adaptive.test"))).scalar_one()
        group = (await session.execute(select(Group).where(Group.name == "Group A2-B1"))).scalar_one_or_none()
        if group is None:
            group = Group(name="Group A2-B1", teacher_id=teacher.id)
            session.add(group)
            await session.flush()

        student_emails = ["alex@adaptive.test", "bella@adaptive.test", "chris@adaptive.test"]
        students = (
            await session.execute(select(User).where(User.email.in_(student_emails)))
        ).scalars().all()
        existing_links = {
            (link.student_id, link.group_id)
            for link in (await session.execute(select(StudentGroup))).scalars().all()
        }
        for student in students:
            key = (student.id, group.id)
            if key in existing_links:
                continue
            session.add(StudentGroup(student_id=student.id, group_id=group.id))

        await session.commit()


async def seed_tests() -> None:
    tests = [
        ("Diagnostic Placement Test", TestType.DIAGNOSTIC, True),
        ("Adaptive English Skills Test", TestType.ADAPTIVE, True),
        ("Final Progress Check", TestType.FINAL, False),
    ]
    async with SessionLocal() as session:
        existing = {
            (test.title, test.type): test
            for test in (await session.execute(select(Test))).scalars().all()
        }
        for title, test_type, is_active in tests:
            if (title, test_type) in existing:
                continue
            session.add(Test(title=title, type=test_type, is_active=is_active))
        await session.commit()


async def seed_questions() -> None:
    async with SessionLocal() as session:
        existing_count = len((await session.execute(select(Question.id))).all())
        if existing_count >= 30:
            return

        for item in question_bank():
            question = Question(
                text=item.text,
                question_type="multiple_choice",
                difficulty=item.difficulty,
                topic=item.topic,
                explanation=item.explanation,
            )
            session.add(question)
            await session.flush()

            for idx, option_text in enumerate(item.options):
                session.add(
                    Option(
                        question_id=question.id,
                        text=option_text,
                        is_correct=idx == item.correct_index,
                    )
                )

        await session.commit()


async def run_seed() -> None:
    await seed_users_and_groups()
    await seed_tests()
    await seed_questions()


if __name__ == "__main__":
    asyncio.run(run_seed())
