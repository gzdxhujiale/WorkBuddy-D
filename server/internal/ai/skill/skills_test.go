package skill

import (
	"testing"
)

func TestBuiltinSkills(t *testing.T) {
	skills := BuiltinSkills()
	if len(skills) != 3 {
		t.Fatalf("expected 3 builtin skills, got %d", len(skills))
	}

	codes := make(map[SkillCode]bool)
	for _, s := range skills {
		if s.Name == "" || s.Description == "" {
			t.Errorf("skill %s missing metadata", s.Code)
		}
		codes[s.Code] = true
	}

	if !codes[SkillDailyReviewSynthesis] || !codes[SkillTaskQuadrantBreakdown] || !codes[SkillProjectStagePlanning] {
		t.Errorf("missing one of the required skills in builtin list")
	}
}

func TestBuildSkillPrompt(t *testing.T) {
	tests := []struct {
		code    SkillCode
		wantErr bool
	}{
		{code: SkillDailyReviewSynthesis, wantErr: false},
		{code: SkillTaskQuadrantBreakdown, wantErr: false},
		{code: SkillProjectStagePlanning, wantErr: false},
		{code: SkillCode("non_existent"), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			msgs, err := BuildSkillPrompt(tt.code, "test goal or input", "2026-10-16")
			if (err != nil) != tt.wantErr {
				t.Fatalf("BuildSkillPrompt(%s) err = %v, wantErr = %v", tt.code, err, tt.wantErr)
			}
			if !tt.wantErr {
				if len(msgs) != 2 {
					t.Fatalf("expected 2 messages (system + user), got %d", len(msgs))
				}
				if msgs[0].Content == "" || msgs[1].Content == "" {
					t.Errorf("empty message content")
				}
			}
		})
	}
}
