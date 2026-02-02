package dns

import (
	"fmt"

	"github.com/miekg/dns"
)

type DNSServer struct {
	RedirectIP string
	Server     *dns.Server
}

func NewDNSServer(redirectIP string) *DNSServer {
	return &DNSServer{
		RedirectIP: redirectIP,
	}
}

func (s *DNSServer) Start() error {
	// 1. Create a specific handler
	handler := dns.HandlerFunc(func(w dns.ResponseWriter, r *dns.Msg) {
		m := new(dns.Msg)
		m.SetReply(r)
		m.Authoritative = true

		for _, question := range r.Question {
			fmt.Printf("[DNS] Capturing Query: %s from %s -> Redirecting to %s\n", question.Name, w.RemoteAddr(), s.RedirectIP)

			// Answer with A record pointing to our RedirectIP
			rr, err := dns.NewRR(fmt.Sprintf("%s A %s", question.Name, s.RedirectIP))
			if err == nil {
				m.Answer = append(m.Answer, rr)
			}
		}

		w.WriteMsg(m)
	})

	// 2. Start UDP Server
	go func() {
		udpServer := &dns.Server{
			Addr:    ":5353",
			Net:     "udp",
			Handler: handler, // Explicitly attach the handler
		}
		fmt.Printf("[DNS] Listening on UDP :5353 (Capturing all traffic)\n")
		if err := udpServer.ListenAndServe(); err != nil {
			fmt.Printf("[DNS] UDP Server Error: %v\n", err)
		}
	}()

	// 3. Start TCP Server
	s.Server = &dns.Server{
		Addr:    ":5353",
		Net:     "tcp",
		Handler: handler, // Explicitly attach the handler
	}
	fmt.Printf("[DNS] Listening on TCP :5353\n")
	return s.Server.ListenAndServe()
}

func (s *DNSServer) Stop() {
	if s.Server != nil {
		s.Server.Shutdown()
	}
}
