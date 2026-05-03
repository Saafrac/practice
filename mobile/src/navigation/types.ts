export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  RoleTabs: undefined;
  DiagnosticTest: undefined;
  AdaptiveTest: undefined;
  FinalTest: undefined;
  History: undefined;
  TeacherStudentResults: { studentId: number; studentName: string };
  TestResult: { attemptId: number };
};
